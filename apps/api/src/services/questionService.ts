import Anthropic from '@anthropic-ai/sdk';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { Matiere, Niveau, NiveauDifficulte } from '@randocours/shared';

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const REDIS_TTL = parseInt(process.env.REDIS_TTL_QUESTIONS || '604800'); // 7 jours

// ── Types internes ────────────────────────────────────────────
interface QuestionBrute {
  question_num: number;
  enonce: string;
  options: Record<string, string>; // {"1": "...", ..., "9": "..."}
  bonne_reponse: number;
  explication: string;
  chapitre: string;
  is_hp: boolean;
  type_erreur_hp?: string;
}

interface StationBrute {
  station_num: number;
  indice_lieu: string;
  indice_suivant: string;
  questions: QuestionBrute[];
}

interface GeneratedData {
  stations: StationBrute[];
  consigne_innovation: string;
  message_secret_lettres: Array<{ station: number; lettre: string }>;
}

interface GenerateParams {
  sessionId: string;
  niveau: Niveau;
  matiere: Matiere;
  theme: string;
  difficulte: NiveauDifficulte;
  nbHallucinations?: number;
}

// ── Programmes BIOF par niveau ────────────────────────────────
const PROGRAMMES_BIOF: Record<string, string[]> = {
  AC1: ['Nombres entiers', 'Fractions', 'Géométrie plane', 'Statistiques', 'Proportionnalité'],
  AC2: ['Algèbre littérale', 'Équations du 1er degré', 'Triangles et théorème de Pythagore', 'Puissances', 'Fonctions'],
  AC3: ['Systèmes d\'équations', 'Théorème de Thalès', 'Trigonométrie', 'Statistiques avancées', 'Probabilités'],
  TC:  ['Fonctions numériques', 'Suites', 'Géométrie analytique', 'Statistiques et probabilités', 'Trigonométrie'],
  BAC1_SE: ['Dérivation', 'Fonctions exponentielles', 'Géométrie dans l\'espace', 'Suites arithmétiques et géométriques', 'Intégration'],
  BAC1_SM: ['Nombres complexes', 'Limites et continuité', 'Dérivées avancées', 'Coniques', 'Probabilités conditionnelles'],
  BAC2_SP: ['Équations différentielles', 'Intégrales', 'Algèbre linéaire', 'Probabilités avancées', 'Fonctions de plusieurs variables'],
  BAC2_SMA: ['Arithmétique', 'Algèbre abstraite', 'Analyse complexe', 'Topologie', 'Probabilités'],
  BAC2_SVT: ['Statistiques descriptives', 'Probabilités', 'Suites', 'Dérivées', 'Fonctions'],
};

// ── Messages secrets par niveau ───────────────────────────────
const MESSAGES_SECRETS: Record<NiveauDifficulte, string> = {
  1: 'PENSERMALGRETOUT',
  2: 'ALKHAWARIZMIESTFIER',
  3: 'LESMATHSSONTPARTOUT',
  4: 'PENSERCESTRESISTER',
  5: 'BATIRLEFUTURENSEMBLE',
};

// ── buildQuestionsPrompt ──────────────────────────────────────
export function buildQuestionsPrompt(params: GenerateParams): string {
  const { niveau, matiere, theme, difficulte, nbHallucinations = 1 } = params;
  const chapitres = PROGRAMMES_BIOF[niveau] || PROGRAMMES_BIOF['AC3'];
  const messageSecret = MESSAGES_SECRETS[difficulte];

  const niveauDesc = [
    '', // index 0 unused
    'Application directe des formules — questions simples et directes',
    'Raisonnement à 2 étapes — légère mise en contexte',
    'Problèmes nécessitant analyse et choix de méthode',
    'Synthèse de plusieurs chapitres — transfert de connaissances',
    'Créativité et innovation — raisonnement critique poussé',
  ][difficulte];

  return `Tu es un expert en pédagogie marocaine et en ${matiere} pour le niveau ${niveau} BIOF Maroc.

MISSION : Générer EXACTEMENT 20 questions QCM en 5 stations de 4 questions chacune.

RÈGLES STRICTES :
1. Chaque station couvre UN chapitre différent parmi : ${chapitres.join(', ')}
2. Chaque question a EXACTEMENT 9 options numérotées 1 à 9, UNE SEULE bonne réponse
3. Les 8 mauvaises réponses sont des PIÈGES PLAUSIBLES (erreurs de signe, unités, formules similaires) — JAMAIS absurdes
4. La bonne réponse est à une position ALÉATOIRE (pas toujours 1 ou 9)
5. Le thème "${theme}" est intégré naturellement dans les énoncés sans dénaturer la rigueur mathématique
6. Niveau de difficulté ${difficulte}/5 : ${niveauDesc}

HALLUCINATIONS (${nbHallucinations} question(s) piégée(s)) :
- Planter EXACTEMENT ${nbHallucinations} hallucination(s) : désigner UNE mauvaise réponse comme correcte dans bonne_reponse
- La VRAIE bonne réponse doit rester présente dans les options
- Marquer ces questions avec is_hp: true et type_erreur_hp expliquant l'erreur

MESSAGE SECRET : Chaque station contribue 1 lettre au message "${messageSecret}"
- Station 1 → Lettre ${messageSecret[0]}, Station 2 → ${messageSecret[1]}, etc.

FORMAT DE SORTIE : JSON UNIQUEMENT — aucun texte avant ou après, aucun markdown
{
  "stations": [
    {
      "station_num": 1,
      "indice_lieu": "Description poétique du lieu où trouver le QR code",
      "indice_suivant": "Indice pour trouver la station suivante",
      "questions": [
        {
          "question_num": 1,
          "enonce": "Énoncé complet avec contexte ${theme}",
          "options": {"1": "...", "2": "...", "3": "...", "4": "...", "5": "...", "6": "...", "7": "...", "8": "...", "9": "..."},
          "bonne_reponse": 4,
          "explication": "Explication pédagogique complète de la bonne réponse ET des pièges principaux",
          "chapitre": "Nom du chapitre",
          "is_hp": false,
          "type_erreur_hp": null
        }
      ]
    }
  ],
  "consigne_innovation": "Mission créative liée au thème pour la Phase Innovation",
  "message_secret_lettres": [
    {"station": 1, "lettre": "${messageSecret[0]}"},
    {"station": 2, "lettre": "${messageSecret[1]}"},
    {"station": 3, "lettre": "${messageSecret[2]}"},
    {"station": 4, "lettre": "${messageSecret[3]}"},
    {"station": 5, "lettre": "${messageSecret[4]}"}
  ]
}`;
}

// ── validateQuestionsStructure ────────────────────────────────
export function validateQuestionsStructure(data: unknown): GeneratedData {
  if (!data || typeof data !== 'object') {
    throw new Error('La réponse IA n\'est pas un objet JSON valide');
  }

  const d = data as any;

  if (!Array.isArray(d.stations) || d.stations.length !== 5) {
    throw new Error(`Nombre de stations invalide : ${d.stations?.length} (attendu: 5)`);
  }

  for (const station of d.stations) {
    if (!Array.isArray(station.questions) || station.questions.length !== 4) {
      throw new Error(`Station ${station.station_num} : ${station.questions?.length} questions (attendu: 4)`);
    }

    for (const q of station.questions) {
      const optionKeys = Object.keys(q.options || {});
      if (optionKeys.length !== 9) {
        throw new Error(`Question ${q.question_num} station ${station.station_num} : ${optionKeys.length} options (attendu: 9)`);
      }

      const bonneRep = q.bonne_reponse;
      if (!Number.isInteger(bonneRep) || bonneRep < 1 || bonneRep > 9) {
        throw new Error(`Question ${q.question_num} : bonne_reponse invalide (${bonneRep})`);
      }

      if (!q.enonce || typeof q.enonce !== 'string' || q.enonce.length < 10) {
        throw new Error(`Question ${q.question_num} : énoncé manquant ou trop court`);
      }
    }
  }

  return d as GeneratedData;
}

// ── generateQuestions ─────────────────────────────────────────
export async function generateQuestions(params: GenerateParams): Promise<GeneratedData> {
  const cacheKey = `questions:${params.niveau}:${params.matiere}:${params.theme}:${params.difficulte}`;

  // 1. Vérifier le cache Redis
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) {
    console.log(`[IA] Cache hit pour ${cacheKey}`);
    return JSON.parse(cached) as GeneratedData;
  }

  // 2. Appel API Claude Sonnet avec retry
  const prompt = buildQuestionsPrompt(params);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`[IA] Génération questions — tentative ${attempt}/3`);

      const response = await anthropic.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      });

      const textContent = response.content.find(c => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('Réponse IA sans contenu texte');
      }

      // Parser le JSON — nettoyer les éventuels backticks markdown
      const jsonText = textContent.text
        .replace(/^```json\s*/m, '')
        .replace(/^```\s*/m, '')
        .replace(/```\s*$/m, '')
        .trim();

      const parsed = JSON.parse(jsonText);
      const validated = validateQuestionsStructure(parsed);

      // 3. Mettre en cache
      await redis.setex(cacheKey, REDIS_TTL, JSON.stringify(validated)).catch(console.error);

      return validated;
    } catch (err: any) {
      lastError = err;
      console.error(`[IA] Tentative ${attempt} échouée :`, err.message);

      if (attempt < 3) {
        const delay = attempt * 1000;
        console.log(`[IA] Attente ${delay}ms avant retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // 4. Fallback — récupérer depuis cache même expiré
  const fallback = await redis.get(`fallback:${params.niveau}:${params.matiere}`).catch(() => null);
  if (fallback) {
    console.warn('[IA] Utilisation du fallback cache (données potentiellement anciennes)');
    return JSON.parse(fallback) as GeneratedData;
  }

  throw new Error(`Génération IA échouée après 3 tentatives : ${lastError?.message}`);
}

// ── saveQuestionsToDb ─────────────────────────────────────────
export async function saveQuestionsToDb(
  sessionId: string,
  data: GeneratedData
): Promise<void> {
  const questions = data.stations.flatMap(station =>
    station.questions.map(q => ({
      sessionId,
      stationNum: station.station_num,
      questionNum: q.question_num,
      enonce: q.enonce,
      options: Object.entries(q.options).map(([num, texte]) => ({
        num: parseInt(num),
        texte,
      })),
      bonneReponse: q.bonne_reponse,
      explication: q.explication,
      chapitre: q.chapitre,
      isHallucination: q.is_hp,
      typeErreurHp: q.type_erreur_hp || null,
    }))
  );

  await prisma.$transaction(
    questions.map(q => prisma.question.create({ data: q }))
  );

  // Mettre à jour le statut de la session
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      status: 'generated',
      messageSecret: MESSAGES_SECRETS[
        (await prisma.session.findUnique({ where: { id: sessionId } }))
          ?.difficulte as NiveauDifficulte ?? 3
      ],
    },
  });
}
