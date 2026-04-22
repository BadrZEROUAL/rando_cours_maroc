import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import {
  analyserSessionIndividuelle,
  analyserSessionCollective,
} from '../services/coachIAService';

const router = Router();
const prisma = new PrismaClient();

// ── POST /api/v1/coach/analyse/individuelle ───────────────────
// Déclenché automatiquement 2h après fin de session (via job)
// Ou manuellement par l'enseignant
router.post(
  '/analyse/individuelle',
  authMiddleware,
  requireRole('enseignant', 'admin', 'super_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { userId, sessionId } = req.body;
    if (!userId || !sessionId) {
      res.status(400).json({ success: false, error: 'userId et sessionId requis' });
      return;
    }
    try {
      const analyse = await analyserSessionIndividuelle(userId, sessionId);
      res.json({ success: true, data: analyse });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ── POST /api/v1/coach/analyse/collective ────────────────────
router.post(
  '/analyse/collective',
  authMiddleware,
  requireRole('enseignant', 'admin', 'super_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { groupeId, sessionId } = req.body;
    if (!groupeId || !sessionId) {
      res.status(400).json({ success: false, error: 'groupeId et sessionId requis' });
      return;
    }
    try {
      const analyse = await analyserSessionCollective(groupeId, sessionId);
      res.json({ success: true, data: analyse });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ── GET /api/v1/coach/jumeau/:groupeId ───────────────────────
// Tableau de bord longitudinal pour le coach humain
router.get(
  '/jumeau/:groupeId',
  authMiddleware,
  requireRole('enseignant', 'admin', 'super_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { groupeId } = req.params;

    const sessions = await prisma.coachIASession.findMany({
      where: { groupeId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Agrégation des lacunes pour les tendances
    const notionFreq: Record<string, number> = {};
    for (const s of sessions) {
      for (const lacune of (s.lacunes as any[])) {
        notionFreq[lacune.notion] = (notionFreq[lacune.notion] || 0) + lacune.frequence;
      }
    }

    const tendances = Object.entries(notionFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([notion, total]) => ({ notion, total }));

    // Alertes actives (lacunes présentes dans 2+ sessions consécutives)
    const alertes: string[] = [];
    if (sessions.length >= 2) {
      const notionsS1 = new Set((sessions[0].lacunes as any[]).map((l: any) => l.notion));
      const notionsS2 = new Set((sessions[1].lacunes as any[]).map((l: any) => l.notion));
      for (const notion of notionsS1) {
        if (notionsS2.has(notion)) {
          alertes.push(`⚠️ Lacune persistante (2+ sessions) : ${notion}`);
        }
      }
    }

    res.json({
      success: true,
      data: {
        groupeId,
        nbSessions: sessions.length,
        tendances,
        alertes,
        historiqueComplet: sessions.map(s => ({
          sessionId: s.sessionId,
          createdAt: s.createdAt,
          lacunes: s.lacunes,
          exercices: s.exercices,
          messageEncouragement: s.messageEncouragement,
          alerteCoachHumain: s.alerteCoachHumain,
        })),
      },
    });
  }
);

// ── GET /api/v1/coach/me ─────────────────────────────────────
// Élève consulte ses propres analyses
router.get(
  '/me',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const sessions = await prisma.coachIASession.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        sessionId: true,
        lacunes: true,
        exercices: true,
        messageEncouragement: true,
        createdAt: true,
      },
    });
    res.json({ success: true, data: sessions });
  }
);

export default router;
