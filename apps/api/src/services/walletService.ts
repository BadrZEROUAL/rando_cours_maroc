import { PrismaClient, TransactionType } from '@prisma/client';
import { RC_CONSTANTS, CreditResult } from '@randocours/shared';

const prisma = new PrismaClient();

// ── Types internes ────────────────────────────────────────────
interface TransferResult {
  soldeWalletApres: number;
  soldeCollectifApres: number;
  transactionId: string;
}

// ── crediterWallet ────────────────────────────────────────────
// Convertit DH en RC et crédite le wallet de l'utilisateur
// Transaction ACID avec SELECT FOR UPDATE pour éviter les race conditions
export async function crediterWallet(
  userId: string,
  montantDh: number,
  adminId: string
): Promise<CreditResult> {
  if (montantDh <= 0) {
    throw new Error('Le montant doit être positif');
  }

  const montantRc = BigInt(Math.round(montantDh * RC_CONSTANTS.TAUX_DH));

  return prisma.$transaction(async (tx) => {
    // SELECT FOR UPDATE — verrouille la ligne pendant la transaction
    const wallet = await tx.$queryRaw<{ id: string; solde_rc: bigint }[]>`
      SELECT id, solde_rc
      FROM wallets
      WHERE user_id = ${userId}
      FOR UPDATE
    `;

    if (!wallet.length) {
      throw new Error(`Wallet introuvable pour l'utilisateur ${userId}`);
    }

    const walletId = wallet[0].id;
    const nouveauSolde = wallet[0].solde_rc + montantRc;

    // Mettre à jour le solde
    await tx.wallet.update({
      where: { id: walletId },
      data: {
        soldeRc: nouveauSolde,
        capitalInvestiDh: { increment: montantDh },
      },
    });

    // Créer la transaction (APPEND ONLY)
    const transaction = await tx.transaction.create({
      data: {
        type: TransactionType.CREDIT_DH,
        sourceId: adminId,
        destId: walletId,
        montantRc,
        montantDh: montantDh,
        metadata: { adminId, montantDhOriginal: montantDh },
      },
    });

    return {
      montantRc: Number(montantRc),
      soldeApres: Number(nouveauSolde),
      transactionId: transaction.id,
    };
  });
}

// ── transfererVersGroupe ──────────────────────────────────────
// Débite le wallet et crédite le compte collectif du groupe
// Une seule transaction ACID pour les deux opérations
export async function transfererVersGroupe(
  userId: string,
  groupeId: string,
  montantRc: number
): Promise<TransferResult> {
  if (montantRc <= 0) {
    throw new Error('Le montant doit être positif');
  }

  const montantBigInt = BigInt(montantRc);

  return prisma.$transaction(async (tx) => {
    // Verrouiller wallet ET compte collectif en même temps
    const [walletRows, compteRows] = await Promise.all([
      tx.$queryRaw<{ id: string; solde_rc: bigint }[]>`
        SELECT id, solde_rc FROM wallets
        WHERE user_id = ${userId}
        FOR UPDATE
      `,
      tx.$queryRaw<{ id: string; solde_rc: bigint; bloque: boolean }[]>`
        SELECT id, solde_rc, bloque FROM comptes_collectifs
        WHERE groupe_id = ${groupeId}
        FOR UPDATE
      `,
    ]);

    if (!walletRows.length) {
      throw Object.assign(new Error('Wallet introuvable'), { code: 'WALLET_NOT_FOUND' });
    }
    if (!compteRows.length) {
      throw Object.assign(new Error('Compte collectif introuvable'), { code: 'COMPTE_NOT_FOUND' });
    }

    const wallet = walletRows[0];
    const compte = compteRows[0];

    if (compte.bloque) {
      throw Object.assign(
        new Error('Le compte collectif est bloqué pour cotisation impayée'),
        { code: 'COMPTE_BLOQUE' }
      );
    }

    if (wallet.solde_rc < montantBigInt) {
      throw Object.assign(
        new Error(`Solde insuffisant : ${wallet.solde_rc} RC disponibles, ${montantRc} RC requis`),
        { code: 'SOLDE_INSUFFISANT' }
      );
    }

    const nouveauSoldeWallet = wallet.solde_rc - montantBigInt;
    const nouveauSoldeCollectif = compte.solde_rc + montantBigInt;

    // Débiter le wallet
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { soldeRc: nouveauSoldeWallet },
    });

    // Créditer le compte collectif
    await tx.compteCollectif.update({
      where: { id: compte.id },
      data: { soldeRc: nouveauSoldeCollectif },
    });

    // Transaction DEBIT
    const txDebit = await tx.transaction.create({
      data: {
        type: TransactionType.DEBIT_WALLET,
        sourceId: wallet.id,
        destId: compte.id,
        montantRc: montantBigInt,
        metadata: { groupeId, userId },
      },
    });

    return {
      soldeWalletApres: Number(nouveauSoldeWallet),
      soldeCollectifApres: Number(nouveauSoldeCollectif),
      transactionId: txDebit.id,
    };
  });
}

// ── getWalletInfo ─────────────────────────────────────────────
export async function getWalletInfo(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { soldeRc: true, capitalInvestiDh: true, updatedAt: true },
  });

  if (!wallet) throw new Error('Wallet introuvable');

  return {
    soldeRc: Number(wallet.soldeRc),
    capitalInvestiDh: Number(wallet.capitalInvestiDh),
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

// ── calculerPool ─────────────────────────────────────────────
// Calcule le pool distribuable (80%) et la commission (20%)
export async function calculerPool(sessionId: string): Promise<{
  totalRc: number;
  commission: number;
  poolDistribuable: number;
}> {
  const sessionGroupes = await prisma.sessionGroupe.findMany({
    where: { sessionId },
    include: { groupe: { include: { compteCollectif: true } } },
  });

  const totalRc = sessionGroupes.reduce((sum, sg) => {
    const solde = sg.groupe.compteCollectif?.soldeRc ?? BigInt(0);
    return sum + Number(solde);
  }, 0);

  const commissionPct = RC_CONSTANTS.COMMISSION_POOL_PCT / 100;
  const commission = Math.floor(totalRc * commissionPct);
  const poolDistribuable = totalRc - commission;

  return { totalRc, commission, poolDistribuable };
}

// ── distribuerPool ────────────────────────────────────────────
export async function distribuerPool(
  sessionId: string,
  scoresGroupes: { groupeId: string; score: number }[]
): Promise<void> {
  const { poolDistribuable, commission } = await calculerPool(sessionId);
  const totalScore = scoresGroupes.reduce((s, g) => s + g.score, 0);

  if (totalScore === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const { groupeId, score } of scoresGroupes) {
      if (score <= 0) continue;
      const part = Math.floor((score / totalScore) * poolDistribuable);
      const partBigInt = BigInt(part);

      const compte = await tx.compteCollectif.findUnique({ where: { groupeId } });
      if (!compte) continue;

      await tx.compteCollectif.update({
        where: { groupeId },
        data: { soldeRc: { increment: partBigInt } },
      });

      await tx.transaction.create({
        data: {
          type: TransactionType.POOL_DISTRIBUTION,
          sourceId: sessionId,
          destId: compte.id,
          montantRc: partBigInt,
          metadata: { sessionId, score, totalScore, poolDistribuable },
        },
      });
    }

    // Enregistrer la commission
    await tx.session.update({
      where: { id: sessionId },
      data: { rcCommission: BigInt(commission), status: 'completed' },
    });
  });
}
