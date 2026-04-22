import prisma from '@/lib/prisma';
import { detecterPartageCode } from './qrCodeService';

type NiveauDifficulte = 1 | 2 | 3 | 4 | 5;

const SCORING = {
  POINTS_PAR_BONNE_REPONSE: (etoiles: NiveauDifficulte) => 5 * etoiles,
  POINTS_TACHE_ABC: (etoiles: NiveauDifficulte) => 50 + etoiles,
  POINTS_TACHE_DE: (etoiles: NiveauDifficulte) => 150 * etoiles,
  MALUS_2EME_ESSAI_DIFFERENT: 5,
  MALUS_2EME_ESSAI_MEME: 10,
};

const RC_CONSTANTS = {
  BONUS_BONNE_REPONSE: 20,
  MALUS_MAUVAISE: 5,
  PENALITE_PARTAGE_PCT: 30,
};

interface ReponseRequest {
  choix: number;
  essai: 1 | 2;
  groupeId: string;
  timestampDebut: number;
}

interface ReponseResult {
  correct: boolean;
  points: number;
  rcVariation: number;
  explication: string;
  penaliteRepetition: boolean;
  partageDetecte: boolean;
}

export async function traiterReponse(
  questionId: string,
  sessionId: string,
  groupeId: string,
  req: ReponseRequest,
  difficulte: NiveauDifficulte
): Promise<ReponseResult> {
  const { choix, essai, timestampDebut } = req;

  // 1. Check anti-random delay (20 seconds)
  const delaiEcoule = Date.now() - timestampDebut;
  if (delaiEcoule < 20000) {
    throw Object.assign(
      new Error(`Délai anti-hasard non respecté : ${delaiEcoule}ms < 20000ms`),
      { code: 'DELAI_NON_ECOULE' }
    );
  }

  // 2. Get question
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new Error('Question introuvable');

  const correct = choix === question.bonneReponse;

  // 3. Calculate points based on difficulty
  let points = 0;
  if (correct) {
    points = SCORING.POINTS_PAR_BONNE_REPONSE(difficulte);
  }

  // 4. Second attempt penalty
  let penaliteRepetition = false;
  if (essai === 2 && !correct) {
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

  // 5. RC variation
  let rcVariation = 0;
  if (correct) {
    rcVariation = RC_CONSTANTS.BONUS_BONNE_REPONSE;
  } else {
    rcVariation = -RC_CONSTANTS.MALUS_MAUVAISE;
  }

  // 6. Code sharing detection
  const codeStation = `${question.stationNum}-${question.bonneReponse}`;
  const { partageDetecte } = await detecterPartageCode(sessionId, groupeId, question.stationNum, codeStation);
  if (partageDetecte) {
    const penalite = Math.floor(Math.abs(rcVariation) * RC_CONSTANTS.PENALITE_PARTAGE_PCT / 100);
    rcVariation -= penalite;
    points = Math.floor(points * (1 - RC_CONSTANTS.PENALITE_PARTAGE_PCT / 100));
  }

  // 7. Persist response
  await prisma.reponseGroupe.create({
    data: {
      sessionId, groupeId, questionId,
      choix, essai, correct, points, rcVariation,
      partageDetecte,
      tempsDepuisQs: delaiEcoule,
    },
  });

  // 8. Update session-group score
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

export async function getScoreboardSession(sessionId: string) {
  const sessionGroupes = await prisma.sessionGroupe.findMany({
    where: { sessionId },
    include: {
      groupe: {
        select: { nom: true, logoEmoji: true, slogan: true },
      },
    },
    orderBy: [{ scoreQcm: 'desc' }, { randoCoins: 'desc' }],
  });

  return sessionGroupes.map((sg) => ({
    groupeId: sg.groupeId,
    nom: sg.groupe.nom,
    logoEmoji: sg.groupe.logoEmoji,
    slogan: sg.groupe.slogan,
    scoreQcm: sg.scoreQcm,
    scoreValidation: sg.scoreValidation,
    scoreTotal: sg.scoreQcm + sg.scoreValidation,
    randoCoins: sg.randoCoins,
  }));
}

// Alias for API compatibility
export const getLeaderboard = getScoreboardSession;

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

  if (isMalusTache) {
    const malus = SCORING.POINTS_TACHE_ABC(difficulte);
    return { points: -malus, rcVariation: -malus };
  }

  return { points: 0, rcVariation: 0 };
}
