import { PrismaClient, TransactionType } from '@prisma/client';
import { ReponseRequest, ReponseResult, SCORING, RC_CONSTANTS, NiveauDifficulte } from '@randocours/shared';
import { detecterPartageCode } from './qrCodeService';

const prisma = new PrismaClient();

// ── traiterReponse ─────────────────────────────────────────────
export async function traiterReponse(
  questionId: string,
  sessionId: string,
  groupeId: string,
  req: ReponseRequest,
  difficulte: NiveauDifficulte
): Promise<ReponseResult> {
  const { choix, essai, timestampDebut } = req;

  // 1. Vérifier le délai anti-hasard (20 secondes)
  const delaiEcoule = Date.now() - timestampDebut;
  if (delaiEcoule < 20000) {
    throw Object.assign(
      new Error(`Délai anti-hasard non respecté : ${delaiEcoule}ms < 20000ms`),
      { code: 'DELAI_NON_ECOULE' }
    );
  }

  // 2. Récupérer la question
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new Error('Question introuvable');

  const correct = choix === question.bonneReponse;

  // 3. Calcul des points selon la difficulté
  let points = 0;
  if (correct) {
    points = SCORING.POINTS_PAR_BONNE_REPONSE(difficulte);
  }

  // 4. Pénalité 2ème essai
  let penaliteRepetition = false;
  if (essai === 2 && !correct) {
    // Récupérer la réponse du 1er essai
    const premierEssai = await prisma.reponseGroupe.findFirst({
      where: { questionId, sessionId, groupeId, essai: 1 },
    });
    if (premierEssai && premierEssai.choix === choix) {
      points -= SCORING.MALUS_2EME_ESSAI_MEME;
      penaliteRepetition = true;
    } else {
      points -= SCORING.MALUS_2EME_ESSAI_DIFFERENT;
    }
  }

  // 5. Variation RC
  let rcVariation = 0;
  if (correct) {
    rcVariation = RC_CONSTANTS.BONUS_BONNE_REPONSE;
  } else {
    rcVariation = -RC_CONSTANTS.MALUS_MAUVAISE;
  }

  // 6. Détection partage de code
  const codeStation = `${question.stationNum}-${question.bonneReponse}`;
  const { partageDetecte } = await detecterPartageCode(sessionId, groupeId, question.stationNum, codeStation);
  if (partageDetecte) {
    const penalite = Math.floor(Math.abs(rcVariation) * RC_CONSTANTS.PENALITE_PARTAGE_PCT / 100);
    rcVariation -= penalite;
    points = Math.floor(points * (1 - RC_CONSTANTS.PENALITE_PARTAGE_PCT / 100));
  }

  // 7. Persister la réponse
  await prisma.reponseGroupe.create({
    data: {
      sessionId, groupeId, questionId,
      choix, essai, correct, points, rcVariation,
      partageDetecte,
      tempsDepuisQs: delaiEcoule,
    },
  });

  // 8. Mettre à jour le score de la session-groupe
  await prisma.$transaction([
    prisma.sessionGroupe.update({
      where: { sessionId_groupeId: { sessionId, groupeId } },
      data: {
        scoreQcm: { increment: points },
        randoCoins: { increment: rcVariation },
      },
    }),
    prisma.compteCollectif.updateMany({
      where: { groupeId },
      data: { soldeRc: { increment: BigInt(rcVariation) } },
    }),
  ]);

  return {
    correct,
    points,
    rcVariation,
    explication: question.explication,
    penaliteRepetition,
    partageDetecte,
  };
}

// ── calculerScoreTache ─────────────────────────────────────────
// Phase 5 — Validation jury
export function calculerScoreTache(
  tache: 'a' | 'b' | 'c' | 'd' | 'e',
  correct: boolean,
  difficulte: NiveauDifficulte
): { points: number; rcVariation: number } {
  const isMalusTache = ['a', 'b', 'c'].includes(tache);

  if (correct) {
    const pts = tache === 'd' || tache === 'e'
      ? SCORING.POINTS_TACHE_DE(difficulte)
      : SCORING.POINTS_TACHE_ABC(difficulte);
    return { points: pts, rcVariation: pts };
  }

  // Incorrect
  if (isMalusTache) {
    const malus = SCORING.POINTS_TACHE_ABC(difficulte);
    return { points: -malus, rcVariation: -malus };
  }

  // Tâches d et e : pas de malus
  return { points: 0, rcVariation: 0 };
}
