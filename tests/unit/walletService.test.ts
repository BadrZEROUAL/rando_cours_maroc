// ============================================================
// tests/unit/walletService.test.ts
// Agent A4 — Tests unitaires walletService
// ============================================================
import { jest } from '@jest/globals';

// ── Mock Prisma ───────────────────────────────────────────────
const mockTx = {
  $queryRaw: jest.fn(),
  wallet: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  compteCollectif: {
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  transaction: {
    create: jest.fn(),
  },
  session: {
    update: jest.fn(),
  },
  sessionGroupe: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $transaction: jest.fn().mockImplementation((fn: any) => fn(mockTx)),
    wallet: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    sessionGroupe: {
      findMany: jest.fn(),
    },
    compteCollectif: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
    },
    session: {
      update: jest.fn(),
    },
  })),
  TransactionType: {
    CREDIT_DH: 'CREDIT_DH',
    DEBIT_WALLET: 'DEBIT_WALLET',
    CREDIT_COLLECTIF: 'CREDIT_COLLECTIF',
    POOL_DISTRIBUTION: 'POOL_DISTRIBUTION',
  },
}));

import { crediterWallet, transfererVersGroupe } from '../../apps/api/src/services/walletService';

// ── Reset mocks avant chaque test ─────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
});

// ── SUITE 1 : crediterWallet ──────────────────────────────────
describe('crediterWallet', () => {
  test('TEST 1 : 10 DH → exactement 1 000 RC (taux 1 DH = 100 RC)', async () => {
    const walletId = 'wallet-uuid-123';
    const soldeInitial = BigInt(100); // Capital initial

    mockTx.$queryRaw.mockResolvedValueOnce([
      { id: walletId, solde_rc: soldeInitial },
    ] as any);

    mockTx.wallet.update.mockResolvedValueOnce({
      id: walletId,
      soldeRc: BigInt(1100),
    } as any);

    mockTx.transaction.create.mockResolvedValueOnce({
      id: 'tx-uuid-abc',
    } as any);

    const result = await crediterWallet('user-uuid', 10, 'admin-uuid');

    expect(result.montantRc).toBe(1000);           // 10 DH × 100 = 1 000 RC
    expect(result.soldeApres).toBe(1100);           // 100 initial + 1 000
    expect(result.transactionId).toBe('tx-uuid-abc');

    // Vérifier que le wallet a été mis à jour avec le bon solde
    expect(mockTx.wallet.update).toHaveBeenCalledWith({
      where: { id: walletId },
      data: expect.objectContaining({
        soldeRc: BigInt(1100),
        capitalInvestiDh: expect.any(Object),
      }),
    });
  });

  test('TEST 2 : La transaction est créée dans la table transactions (APPEND ONLY)', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([
      { id: 'wallet-id', solde_rc: BigInt(100) },
    ] as any);
    mockTx.wallet.update.mockResolvedValueOnce({} as any);
    mockTx.transaction.create.mockResolvedValueOnce({ id: 'tx-new' } as any);

    await crediterWallet('user-id', 50, 'admin-id');

    expect(mockTx.transaction.create).toHaveBeenCalledTimes(1);
    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'CREDIT_DH',
        montantRc: BigInt(5000), // 50 DH × 100
        montantDh: 50,
      }),
    });
  });

  test('TEST 3 : Un montant négatif ou nul lance une erreur', async () => {
    await expect(crediterWallet('user-id', -50, 'admin-id')).rejects.toThrow(
      'Le montant doit être positif'
    );
    await expect(crediterWallet('user-id', 0, 'admin-id')).rejects.toThrow(
      'Le montant doit être positif'
    );

    // Aucun appel DB ne doit avoir eu lieu
    expect(mockTx.$queryRaw).not.toHaveBeenCalled();
  });

  test('TEST 4 : Wallet introuvable lance une erreur claire', async () => {
    mockTx.$queryRaw.mockResolvedValueOnce([] as any); // Aucun wallet trouvé

    await expect(crediterWallet('inexistant-user', 10, 'admin-id')).rejects.toThrow(
      'Wallet introuvable'
    );
  });
});

// ── SUITE 2 : transfererVersGroupe ────────────────────────────
describe('transfererVersGroupe', () => {
  test('TEST 5 : Solde insuffisant → erreur avec code SOLDE_INSUFFISANT', async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([
        { id: 'wallet-id', solde_rc: BigInt(500) }, // Seulement 500 RC
      ] as any)
      .mockResolvedValueOnce([
        { id: 'compte-id', solde_rc: BigInt(0), bloque: false },
      ] as any);

    const error = await transfererVersGroupe('user-id', 'groupe-id', 1000).catch(e => e);
    expect(error.code).toBe('SOLDE_INSUFFISANT');
    expect(error.message).toContain('500');
  });

  test('TEST 6 : Compte collectif bloqué → erreur COMPTE_BLOQUE', async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([
        { id: 'wallet-id', solde_rc: BigInt(5000) },
      ] as any)
      .mockResolvedValueOnce([
        { id: 'compte-id', solde_rc: BigInt(0), bloque: true }, // Compte bloqué
      ] as any);

    const error = await transfererVersGroupe('user-id', 'groupe-id', 100).catch(e => e);
    expect(error.code).toBe('COMPTE_BLOQUE');
  });

  test('TEST 7 : Transfert valide → débite wallet ET crédite compte collectif', async () => {
    mockTx.$queryRaw
      .mockResolvedValueOnce([
        { id: 'wallet-id', solde_rc: BigInt(2000) },
      ] as any)
      .mockResolvedValueOnce([
        { id: 'compte-id', solde_rc: BigInt(500), bloque: false },
      ] as any);

    mockTx.wallet.update.mockResolvedValueOnce({} as any);
    mockTx.compteCollectif.update.mockResolvedValueOnce({} as any);
    mockTx.transaction.create.mockResolvedValueOnce({ id: 'tx-transfer' } as any);

    const result = await transfererVersGroupe('user-id', 'groupe-id', 300);

    expect(result.soldeWalletApres).toBe(1700);     // 2000 - 300
    expect(result.soldeCollectifApres).toBe(800);   // 500 + 300
    expect(result.transactionId).toBe('tx-transfer');

    // Vérifier les deux updates
    expect(mockTx.wallet.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { soldeRc: BigInt(1700) } })
    );
    expect(mockTx.compteCollectif.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { soldeRc: BigInt(800) } })
    );
  });
});
