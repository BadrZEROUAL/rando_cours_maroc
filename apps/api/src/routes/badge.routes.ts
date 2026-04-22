import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { logExportDonnees } from '../middleware/cndp.middleware';
import {
  genererCertificat,
  genererOpenBadgeJSON,
  uploadCertificat,
  uploadBadgeJSON,
} from '../services/certificateService';
import { getScoreboardSession } from '../services/scoringService';
import { BadgeData, NiveauDifficulte, Matiere } from '@randocours/shared';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const prisma = new PrismaClient();

// Seuil minimum pour obtenir un badge (60% du score max)
const SEUIL_PASSAGE = 0.60;

// ── POST /api/v1/badges/generer/:sessionId ────────────────────
// Déclenché automatiquement après distribution du pool (fin de session)
router.post(
  '/generer/:sessionId',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      res.status(404).json({ success: false, error: 'Session introuvable' });
      return;
    }

    const scoreboard = await getScoreboardSession(sessionId);
    const badgesGeneres: string[] = [];

    for (const groupe of scoreboard) {
      const scoreTotal = groupe.scoreTotal;
      // Calcul du score max selon difficulté
      const scoreMax = (50 + session.difficulte) * 20 * 3 + 5 * session.difficulte * 20;
      if (scoreTotal < scoreMax * SEUIL_PASSAGE) continue;

      // Récupérer les membres du groupe
      const membres = await prisma.groupeMembre.findMany({
        where: { groupeId: groupe.groupeId },
        include: { user: { select: { id: true, email: true } } },
      });

      for (const membre of membres) {
        const badgeId = uuidv4();
        const APP_URL = process.env.APP_URL || 'https://randocours.ma';

        const badgeData: BadgeData = {
          id: badgeId,
          eleveId: membre.userId,
          niveau: session.difficulte as NiveauDifficulte,
          matiere: session.matiere as unknown as Matiere,
          score: scoreTotal,
          scoreMax,
          competencesValidees: [
            'pensee_critique', 'debat', 'creativite', 'cooperation', 'meta_apprentissage',
          ],
          issuedOn: new Date().toISOString(),
          verifyUrl: `${APP_URL}/api/v1/badges/verify/${badgeId}`,
          pdfUrl: '',
        };

        try {
          // Générer PDF
          const pdfBuffer = await genererCertificat(badgeData);
          const pdfUrl = await uploadCertificat(pdfBuffer, badgeId);

          // Générer Open Badge JSON
          const badgeJson = genererOpenBadgeJSON(
            { ...badgeData, pdfUrl },
            membre.user.email
          );
          const badgeJsonUrl = await uploadBadgeJSON(badgeJson, badgeId);

          // Persister en base
          await prisma.badge.create({
            data: {
              id: badgeId,
              eleveId: membre.userId,
              groupeId: groupe.groupeId,
              sessionId,
              niveau: session.difficulte,
              matiere: session.matiere,
              score: scoreTotal,
              scoreMax,
              competencesValidees: badgeData.competencesValidees,
              pdfUrl,
              badgeJsonUrl,
            },
          });

          badgesGeneres.push(badgeId);
        } catch (err: any) {
          console.error(`[BADGE] Erreur génération badge pour ${membre.userId}:`, err.message);
        }
      }
    }

    res.json({
      success: true,
      data: { badgesGeneres: badgesGeneres.length, ids: badgesGeneres },
    });
  }
);

// ── GET /api/v1/badges/verify/:id ────────────────────────────
// Route PUBLIQUE — vérification d'un badge par QR code
router.get('/verify/:id', async (req: Request, res: Response): Promise<void> => {
  const badge = await prisma.badge.findUnique({
    where: { id: req.params.id },
    select: {
      id: true, niveau: true, matiere: true, score: true, scoreMax: true,
      competencesValidees: true, issuedOn: true, revoque: true,
      eleve: { select: { email: true } },
    },
  });

  if (!badge) {
    res.status(404).json({ valide: false, error: 'Badge introuvable' });
    return;
  }

  if (badge.revoque) {
    res.status(200).json({ valide: false, revoque: true, id: badge.id });
    return;
  }

  res.json({
    valide: true,
    id: badge.id,
    niveau: badge.niveau,
    matiere: badge.matiere,
    score: badge.score,
    scoreMax: badge.scoreMax,
    competences: badge.competencesValidees,
    date: badge.issuedOn,
    issuer: 'RandoCours Maroc — randocours.ma',
  });
});

// ── GET /api/v1/badges/mes-badges ────────────────────────────
router.get(
  '/mes-badges',
  authMiddleware,
  logExportDonnees('badge'),
  async (req: Request, res: Response): Promise<void> => {
    const badges = await prisma.badge.findMany({
      where: { eleveId: req.user!.id, revoque: false },
      orderBy: { issuedOn: 'desc' },
      select: {
        id: true, niveau: true, matiere: true, score: true,
        scoreMax: true, pdfUrl: true, badgeJsonUrl: true, issuedOn: true,
      },
    });
    res.json({ success: true, data: badges });
  }
);

export default router;
