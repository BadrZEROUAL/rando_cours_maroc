import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();

const createSessionSchema = z.object({
  niveau: z.string(),
  matiere: z.string(),
  theme: z.string().min(2),
  difficulte: z.number().int().min(1).max(5),
  nbGroupes: z.number().int().min(2).max(6),
  nbHallucinations: z.number().int().min(0).max(3).default(1),
});

// ── GET /api/v1/sessions ─────────────────────────────────────
router.get(
  '/',
  authMiddleware,
  requireRole('enseignant', 'admin', 'super_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const sessions = await prisma.session.findMany({
      where: { enseignantId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, niveau: true, matiere: true, theme: true,
        difficulte: true, nbGroupes: true, status: true, createdAt: true,
      },
    });
    res.json({ success: true, data: sessions });
  }
);

// ── POST /api/v1/sessions ────────────────────────────────────
router.post(
  '/',
  authMiddleware,
  requireRole('enseignant', 'admin', 'super_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: 'Données invalides', details: parsed.error.flatten() });
      return;
    }
    const session = await prisma.session.create({
      data: { ...parsed.data, enseignantId: req.user!.id, status: 'configured' },
    });
    res.status(201).json({ success: true, data: session });
  }
);

// ── GET /api/v1/sessions/:id ─────────────────────────────────
router.get(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const session = await prisma.session.findUnique({
      where: { id: req.params.id },
      include: {
        sessionGroupes: {
          include: { groupe: { select: { nom: true, logoEmoji: true, slogan: true } } },
          orderBy: { scoreQcm: 'desc' },
        },
      },
    });
    if (!session) {
      res.status(404).json({ success: false, error: 'Session introuvable' });
      return;
    }
    res.json({ success: true, data: session });
  }
);

// ── GET /api/v1/sessions/:id/scoreboard ─────────────────────
router.get(
  '/:id/scoreboard',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const { getScoreboardSession } = await import('../services/scoringService');
    try {
      const scoreboard = await getScoreboardSession(req.params.id);
      res.json({ success: true, data: scoreboard });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

export default router;
