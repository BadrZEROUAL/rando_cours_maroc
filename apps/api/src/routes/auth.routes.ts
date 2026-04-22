import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { logExportDonnees } from '../middleware/cndp.middleware';

const router = Router();
const prisma = new PrismaClient();

// ── DELETE /api/v1/auth/me/data ───────────────────────────────
// Anonymisation des données personnelles (Loi 09-08 CNDP Maroc)
// Droit à l'effacement — Article 7 Loi 09-08
router.delete(
  '/me/data',
  authMiddleware,
  logExportDonnees('user_anonymisation'),
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Anonymiser les données personnelles identifiantes
        await tx.user.update({
          where: { id: userId },
          data: {
            email: `deleted_${userId}@anonymized.ma`,
            telephone: null,
            parentEmail: null,
            estActif: false,
            // NE PAS effacer : id, role, createdAt (traçabilité)
            // NE PAS effacer les transactions (obligations fiscales 5 ans)
          },
        });

        // 2. Dissocier le wallet (conserver les transactions)
        // Les transactions restent pour obligations fiscales Maroc
        // Article 89 du Code Général des Impôts — 5 ans minimum

        // 3. Log d'audit CNDP
        await tx.auditLog.create({
          data: {
            acteurId: userId,
            action: 'SELF_ANONYMISATION',
            cibleType: 'user',
            cibleId: userId,
            ip: (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown',
            userAgent: req.headers['user-agent'] || 'unknown',
          },
        });
      });

      res.status(200).json({
        success: true,
        data: {
          message: 'Vos données personnelles ont été anonymisées conformément à la Loi 09-08.',
          userId,
          anonymisedAt: new Date().toISOString(),
          note: 'Les transactions financières sont conservées 5 ans (obligations fiscales Maroc).',
        },
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: 'Échec de l\'anonymisation',
        code: 'ANONYMISATION_FAILED',
      });
    }
  }
);

// ── GET /api/v1/auth/me ───────────────────────────────────────
router.get(
  '/me',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        role: true,
        langue: true,
        isMineur: true,
        consentementParent: true,
        estActif: true,
        createdAt: true,
        wallet: { select: { soldeRc: true, capitalInvestiDh: true } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'Utilisateur introuvable' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...user,
        wallet: user.wallet
          ? { soldeRc: Number(user.wallet.soldeRc), capitalInvestiDh: Number(user.wallet.capitalInvestiDh) }
          : null,
      },
    });
  }
);

export default router;
