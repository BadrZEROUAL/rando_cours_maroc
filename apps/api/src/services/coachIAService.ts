import Anthropic from '@anthropic-ai/sdk';
import { PrismaClient } from '@prisma/client';
import {
  CoachAnalyseIndividuelle,
  LacuneIA,
  ExerciceSocrate,
} from '@randocours/shared';

const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT_SOCRATE = `Tu es le Coach IA de RandoCours Maroc.

RÈGLE ABSOLUE MODE SOCRATE — À RESPECTER SANS EXCEPTION :
Tu ne donnes JAMAIS de réponse directe, même si l'élève te la demande explicitement.
Tu réponds TOUJOURS par une question de guidage progressive qui amène l'élève à découvrir lui-même.
Exemple INTERDIT : "La dérivée de x² est 2x."
Exemple CORRECT : "Quelle est la règle générale pour dériver une puissance de x ?"

CONTEXTE : Tu analyses les résultats d'une session Escape Game RandoCours.
Les élèves ont répondu à des QCM à 9 options avec des distracteurs intelligents.

FORMAT DE SORTIE : JSON UNIQUEMENT — aucun texte avant ou après.`;

// ── analyserSessionIndividuelle ───────────────────────────────
export async function analyserSessionIndividuelle(
  userId: string,
  sessionId: string
): Promise<CoachAnalyseIndividuelle> {
  // Récupérer toutes les réponses de l'utilisateur
  const reponses = await prisma.reponseGroupe.findMany({
    where: { sessionId },
    include: { question: true },
  });

  // Récupérer l'historique des sessions précédentes
  const historique = await prisma.coachIASession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { lacunes: true, createdAt: true },
  });

  const erreurs = reponses.filter(r => !r.correct);
  const totalReponses = reponses.length;
  const taux = Math.round(((totalReponses - erreurs.length) / totalReponses) * 100);

  const userPrompt = `Analyse ces résultats d'un élève en session RandoCours :

STATISTIQUES :
- Taux de réussite : ${taux}% (${totalReponses - erreurs.length}/${totalReponses})
- Nombre d'erreurs : ${erreurs.length}

ERREURS DÉTAILLÉES :
${erreurs.map(r => `- Question sur "${r.question.chapitre}" : choix ${r.choix} (bonne réponse : ${r.question.bonneReponse}). Explication : ${r.question.explication}`).join('\n')}

HISTORIQUE (3 dernières sessions) :
${historique.length > 0
    ? historique.map(h => `- ${new Date(h.createdAt).toLocaleDateString('fr-MA')} : ${JSON.stringify(h.lacunes)}`).join('\n')
    : '- Première session'}

Génère une analyse en JSON avec exactement cette structure :
{
  "lacunes": [
    {"notion": "Nom de la notion", "frequence": 2, "typeErreur": "Description de l'erreur typique"}
  ],
  "exercices": [
    {
      "titre": "Titre de l'exercice",
      "questionSocrate": "Question qui guide sans donner la réponse",
      "objectif": "Ce que l'élève va découvrir",
      "indiceSiBloque": "Piste supplémentaire si l'élève est bloqué"
    }
  ],
  "messageEncouragement": "Message positif et motivant",
  "alerteCoachHumain": "Message d'alerte si nécessaire (null sinon)"
}

Identifie exactement 3 lacunes prioritaires et propose 3 exercices en mode Socrate.`;

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT_SOCRATE,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content.find(c => c.type === 'text');
  if (!text || text.type !== 'text') throw new Error('Réponse Coach IA vide');

  const cleaned = text.text.replace(/```json\s*/m, '').replace(/```\s*$/m, '').trim();
  const analyse: CoachAnalyseIndividuelle = JSON.parse(cleaned);

  // Persister en base
  await prisma.coachIASession.create({
    data: {
      userId,
      groupeId: reponses[0]?.groupeId || '',
      sessionId,
      lacunes: analyse.lacunes as any,
      exercices: analyse.exercices as any,
      messageEncouragement: analyse.messageEncouragement,
      alerteCoachHumain: analyse.alerteCoachHumain || null,
    },
  });

  return analyse;
}

// ── analyserSessionCollective ─────────────────────────────────
export async function analyserSessionCollective(
  groupeId: string,
  sessionId: string
): Promise<{
  patternsCommuns: LacuneIA[];
  miniDefiHebdo: ExerciceSocrate;
  alerteCoachHumain: string | null;
  rapportMarkdown: string;
}> {
  const analyses = await prisma.coachIASession.findMany({
    where: { groupeId, sessionId },
    select: { lacunes: true, userId: true },
  });

  if (!analyses.length) {
    throw new Error('Aucune analyse individuelle disponible pour ce groupe');
  }

  // Agréger les lacunes
  const notionCount: Record<string, number> = {};
  for (const a of analyses) {
    for (const lacune of (a.lacunes as LacuneIA[])) {
      notionCount[lacune.notion] = (notionCount[lacune.notion] || 0) + 1;
    }
  }

  const totalMembres = analyses.length;
  const patternsCommuns = Object.entries(notionCount)
    .filter(([, count]) => count > totalMembres * 0.5) // > 50% du groupe
    .map(([notion, frequence]) => ({ notion, frequence, typeErreur: 'Pattern collectif' }));

  const promptCollectif = `Analyse collective d'un groupe RandoCours (${totalMembres} membres) :

LACUNES COMMUNES (présentes chez >50% du groupe) :
${patternsCommuns.map(p => `- ${p.notion} : ${p.frequence}/${totalMembres} membres`).join('\n') || 'Aucune lacune commune significative'}

Génère en JSON :
{
  "miniDefiHebdo": {
    "titre": "Défi collectif de la semaine",
    "questionSocrate": "Question Socrate pour le groupe",
    "objectif": "Ce que le groupe va découvrir ensemble",
    "indiceSiBloque": "Piste collective"
  },
  "alerteCoachHumain": "Message d'urgence pour l'enseignant (null si tout va bien)",
  "rapportMarkdown": "Rapport complet en markdown pour le coach humain"
}`;

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: SYSTEM_PROMPT_SOCRATE,
    messages: [{ role: 'user', content: promptCollectif }],
  });

  const text = response.content.find(c => c.type === 'text');
  if (!text || text.type !== 'text') throw new Error('Réponse vide');

  const cleaned = text.text.replace(/```json\s*/m, '').replace(/```\s*$/m, '').trim();
  const result = JSON.parse(cleaned);

  return {
    patternsCommuns,
    miniDefiHebdo: result.miniDefiHebdo,
    alerteCoachHumain: result.alerteCoachHumain,
    rapportMarkdown: result.rapportMarkdown,
  };
}
