import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { logAccesDonneesPersonnelles } from '../middleware/cndp.middleware';
import {
  crediterWallet,
  transfererVersGroupe,
  getWalletInfo,
} from '../services/walletService';
import { z } from 'zod';

const router = Router();

// ── Schémas de validation Zod ─────────────────────────────────
const creditSchema = z.object({
  userId: z.string().uuid(),
  montantDh: z.number().positive('Le montant doit être positif'),
});

const transferSchema = z.object({
  groupeId: z.string().uuid(),
  montantRc: z.number().int().positive(),
});

// ── POST /api/v1/wallet/credit ────────────────────────────────
// Admin uniquement — créditer un wallet depuis un paiement cash
router.post(
  '/credit',
  authMiddleware,
  requireRole('admin', 'super_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = creditSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const result = await crediterWallet(
        parsed.data.userId,
        parsed.data.montantDh,
        req.user!.id
      );
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.message,
        code: err.code,
      });
    }
  }
);

// ── POST /api/v1/wallet/transfer ──────────────────────────────
// Élève — transférer des RC vers le compte collectif du groupe
router.post(
  '/transfer',
  authMiddleware,
  requireRole('eleve'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Données invalides',
        details: parsed.error.flatten(),
      });
      return;
    }

    try {
      const result = await transfererVersGroupe(
        req.user!.id,
        parsed.data.groupeId,
        parsed.data.montantRc
      );
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      const status = err.code === 'SOLDE_INSUFFISANT' ? 402 : 400;
      res.status(status).json({
        success: false,
        error: err.message,
        code: err.code,
      });
    }
  }
);

// ── GET /api/v1/wallet/me ─────────────────────────────────────
// Tout utilisateur authentifié — consulter son propre wallet
router.get(
  '/me',
  authMiddleware,
  logAccesDonneesPersonnelles,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const info = await getWalletInfo(req.user!.id);
      res.status(200).json({ success: true, data: info });
    } catch (err: any) {
      res.status(404).json({ success: false, error: err.message });
    }
  }
);

export default router;
