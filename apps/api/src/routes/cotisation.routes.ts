import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { RC_CONSTANTS } from '@randocours/shared';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

// ── POST /api/v1/cotisation/pay ───────────────────────────────
// Enregistre le paiement d'une cotisation mensuelle
router.post(
  '/pay',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const { cotisationId, groupeId } = req.body;
    if (!cotisationId || !groupeId) {
      res.status(400).json({ success: false, error: 'cotisationId et groupeId requis' });
      return;
    }

    const cotisation = await prisma.cotisation.findUnique({
      where: { id: cotisationId },
      include: { groupe: true },
    });

    if (!cotisation) {
      res.status(404).json({ success: false, error: 'Cotisation introuvable' });
      return;
    }
    if (cotisation.isPaid) {
      res.status(400).json({ success: false, error: 'Cotisation déjà payée', code: 'DEJA_PAYEE' });
      return;
    }

    // Calculer la prochaine date d'échéance (1 mois)
    const prochaineDate = new Date(cotisation.dueAt);
    prochaineDate.setMonth(prochaineDate.getMonth() + 1);

    await prisma.$transaction([
      // Marquer comme payée
      prisma.cotisation.update({
        where: { id: cotisationId },
        data: { isPaid: true, paidAt: new Date() },
      }),
      // Créer la prochaine cotisation
      prisma.cotisation.create({
        data: {
          groupeId,
          montantDh: RC_CONSTANTS.COTISATION_DH,
          dueAt: prochaineDate,
        },
      }),
      // Débloquer le compte collectif si bloqué
      prisma.compteCollectif.update({
        where: { groupeId },
        data: { bloque: false },
      }),
    ]);

    res.json({
      success: true,
      data: {
        message: 'Cotisation payée — compte débloqué',
        prochainePaiement: prochaineDate.toISOString(),
      },
    });
  }
);

// ── GET /api/v1/cotisation/:groupeId ─────────────────────────
router.get(
  '/:groupeId',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const cotisations = await prisma.cotisation.findMany({
      where: { groupeId: req.params.groupeId },
      orderBy: { dueAt: 'desc' },
      take: 12,
    });

    const compte = await prisma.compteCollectif.findUnique({
      where: { groupeId: req.params.groupeId },
      select: { bloque: true, soldeRc: true },
    });

    res.json({
      success: true,
      data: {
        cotisations,
        compteBloque: compte?.bloque ?? false,
        soldeRc: Number(compte?.soldeRc ?? 0),
      },
    });
  }
);

export default router;
