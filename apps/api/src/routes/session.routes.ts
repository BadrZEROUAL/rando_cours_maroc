import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth.middleware';
import { traiterReponse } from '../services/scoringService';
import {
  validateQRScan,
  generateAllQRCodesForSession,
  genererParcoursGroupes,
} from '../services/qrCodeService';
import { generateQuestions, saveQuestionsToDb } from '../services/questionService';

const router = Router();
const prisma = new PrismaClient();

// ── POST / — Créer une session ─────────────────────────────────
router.post('/',
  authMiddleware,
  requireRole('enseignant', 'admin', 'super_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const { niveau, matiere, theme, difficulte, nbGroupes, nbHallucinations } = req.body;
    try {
      const session = await prisma.session.create({
        data: {
          niveau, matiere, theme,
          difficulte: difficulte ?? 3,
          nbGroupes: nbGroupes ?? 3,
          nbHallucinations: nbHallucinations ?? 1,
          enseignantId: req.user!.id,
          status: 'configured',
        },
      });
      res.status(201).json({ success: true, data: { sessionId: session.id } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ── POST /:id/generate — Générer 20 questions via IA ──────────
router.post('/:id/generate',
  authMiddleware,
  requireRole('enseignant', 'admin', 'super_admin'),
  async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.params.id;
    try {
      const session = await prisma.session.findUnique({ where: { id: sessionId } });
      if (!session) { res.status(404).json({ success: false, error: 'Session introuvable' }); return; }

      const data = await generateQuestions({
        sessionId,
        niveau: session.niveau as any,
        matiere: session.matiere as any,
        theme: session.theme,
        difficulte: session.difficulte as any,
        nbHallucinations: session.nbHallucinations,
      });
      await saveQuestionsToDb(sessionId, data);
      res.status(200).json({ success: true, data: { nbQuestions: 20 } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ── POST /:id/start — Lancer le jeu ───────────────────────────
router.post('/:id/start',
  authMiddleware,
  requireRole('enseignant', 'admin'),
  async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.params.id;
    const { groupes, lieux } = req.body as { groupes: string[]; lieux: string[] };
    try {
      const parcours = genererParcoursGroupes(lieux, groupes.length);
      await prisma.$transaction(
        groupes.map((groupeId, idx) =>
          prisma.sessionGroupe.create({
            data: {
              sessionId, groupeId,
              parcoursOrdre: parcours[`groupe_${idx + 1}`],
            },
          })
        )
      );
      await prisma.session.update({ where: { id: sessionId }, data: { status: 'active' } });
      await generateAllQRCodesForSession(sessionId, parcours);
      res.status(200).json({ success: true, data: { parcours } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ── POST /questions/:id/reponse — Soumettre une réponse ────────
router.post('/questions/:id/reponse',
  authMiddleware,
  requireRole('eleve'),
  async (req: Request, res: Response): Promise<void> => {
    const { choix, essai, groupeId, timestampDebut } = req.body;
    try {
      const question = await prisma.question.findUnique({
        where: { id: req.params.id },
        include: { session: true },
      });
      if (!question) { res.status(404).json({ success: false, error: 'Question introuvable' }); return; }

      const result = await traiterReponse(
        req.params.id, question.sessionId, groupeId,
        { choix, essai, groupeId, timestampDebut },
        question.session.difficulte as any
      );
      res.status(200).json({ success: true, data: result });
    } catch (err: any) {
      const status = err.code === 'DELAI_NON_ECOULE' ? 429 : 500;
      res.status(status).json({ success: false, error: err.message, code: err.code });
    }
  }
);

// ── POST /qrcode/scan — Scanner un QR ─────────────────────────
router.post('/qrcode/scan',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const { token } = req.body as { token: string };
    const groupeId = req.user?.groupeId;
    if (!groupeId) { res.status(403).json({ success: false, error: 'Groupe non assigné' }); return; }

    const scanResult = await validateQRScan(token, groupeId);
    if (!scanResult.valid) {
      const statusMap: Record<string, number> = {
        QR_EXPIRED: 410, QR_INVALID: 403, QR_WRONG_GROUPE: 403, QR_ALREADY_USED: 409,
      };
      res.status(statusMap[scanResult.error!] || 400).json({ success: false, error: scanResult.error });
      return;
    }
    const { sessionId, stationNum } = scanResult.payload!;
    const questions = await prisma.question.findMany({
      where: { sessionId, stationNum },
      orderBy: { questionNum: 'asc' },
      select: { id: true, stationNum: true, questionNum: true, enonce: true, options: true, chapitre: true },
    });
    res.status(200).json({ success: true, data: { payload: scanResult.payload, questions } });
  }
);

// ── POST /fragments/:groupeId/verify — Vérifier les 5 fragments
router.post('/fragments/:groupeId/verify',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const { groupeId } = req.params;
    const { sessionId } = req.body as { sessionId: string };
    const reponses = await prisma.reponseGroupe.findMany({
      where: { sessionId, groupeId, correct: true },
      include: { question: true },
      distinct: ['questionId'],
    });
    const stationsCompletes = new Set(reponses.map(r => r.question.stationNum));
    if (stationsCompletes.size < 5) {
      const manquants = [1,2,3,4,5].filter(n => !stationsCompletes.has(n));
      res.json({ success: true, data: { valid: false, fragmentsManquants: manquants } });
      return;
    }
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    res.json({ success: true, data: { valid: true, codeComplet: session?.messageSecret } });
  }
);

export default router;
