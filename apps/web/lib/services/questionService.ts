import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface GeneratedQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explication: string;
  difficulte: 'FACILE' | 'MOYEN' | 'DIFFICILE';
}

// Generate QCM questions using Claude
export async function generateQCMQuestions(
  thematique: string,
  niveau: string,
  count: number = 5
): Promise<GeneratedQuestion[]> {
  const prompt = `Tu es un expert en randonnée et activités de plein air au Maroc. 
Génère ${count} questions QCM (Questions à Choix Multiples) sur le thème "${thematique}" 
pour un niveau "${niveau}".

Chaque question doit avoir:
- Une question claire et précise
- 4 options de réponse (A, B, C, D)
- L'index de la bonne réponse (0-3)
- Une explication courte de la bonne réponse
- Un niveau de difficulté (FACILE, MOYEN, DIFFICILE)

Réponds uniquement en JSON avec ce format:
{
  "questions": [
    {
      "question": "...",
      "options": ["A...", "B...", "C...", "D..."],
      "correctIndex": 0,
      "explication": "...",
      "difficulte": "FACILE"
    }
  ]
}

Assure-toi que les questions sont:
- Pertinentes pour la randonnée au Maroc
- Éducatives et informatives
- Variées en difficulté
- Adaptées au contexte marocain (géographie, culture, sécurité, environnement)`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.questions as GeneratedQuestion[];
  } catch (error) {
    console.error('Error generating QCM questions:', error);
    // Return fallback questions
    return getFallbackQuestions(thematique, count);
  }
}

// Get questions for a session
export async function getSessionQuestions(sessionId: string, userId: string) {
  const participation = await prisma.participation.findFirst({
    where: { sessionId, userId },
    include: {
      reponses: true,
    },
  });

  const questions = await prisma.question.findMany({
    where: { sessionId },
    orderBy: { ordre: 'asc' },
  });

  return questions.map((q) => {
    const reponse = participation?.reponses.find((r) => r.questionId === q.id);
    return {
      id: q.id,
      question: q.question,
      options: q.options as string[],
      ordre: q.ordre,
      difficulte: q.difficulte,
      answered: !!reponse,
      selectedIndex: reponse?.reponseIndex,
      isCorrect: reponse?.correct,
      explication: reponse ? q.explication : null, // Only show explanation after answering
    };
  });
}

// Submit answer to a question
export async function submitAnswer(
  questionId: string,
  userId: string,
  reponseIndex: number
): Promise<{
  correct: boolean;
  correctIndex: number;
  explication: string;
  pointsEarned: number;
  tempsReponse: number;
}> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { session: true },
  });

  if (!question) {
    throw new Error('Question non trouvée');
  }

  // Get participation
  const participation = await prisma.participation.findFirst({
    where: {
      sessionId: question.sessionId,
      userId,
    },
  });

  if (!participation) {
    throw new Error('Participation non trouvée');
  }

  // Check if already answered
  const existingAnswer = await prisma.reponse.findFirst({
    where: {
      participationId: participation.id,
      questionId,
    },
  });

  if (existingAnswer) {
    throw new Error('Vous avez déjà répondu à cette question');
  }

  const correct = reponseIndex === question.correctIndex;
  const tempsReponse = Math.floor(Math.random() * 30) + 5; // Simulated time in seconds

  // Calculate points based on difficulty and correctness
  let pointsEarned = 0;
  if (correct) {
    switch (question.difficulte) {
      case 'FACILE':
        pointsEarned = 10;
        break;
      case 'MOYEN':
        pointsEarned = 20;
        break;
      case 'DIFFICILE':
        pointsEarned = 30;
        break;
    }
    // Bonus for quick answers
    if (tempsReponse < 10) {
      pointsEarned += 5;
    }
  }

  // Save answer
  await prisma.reponse.create({
    data: {
      participationId: participation.id,
      questionId,
      reponseIndex,
      correct,
      tempsReponse,
    },
  });

  // Update participation score
  await prisma.participation.update({
    where: { id: participation.id },
    data: {
      score: { increment: pointsEarned },
    },
  });

  // Update wallet if points earned
  if (pointsEarned > 0) {
    const wallet = await prisma.portefeuille.findUnique({
      where: { userId },
    });

    if (wallet) {
      await prisma.portefeuille.update({
        where: { id: wallet.id },
        data: {
          solde: { increment: pointsEarned },
        },
      });

      await prisma.transaction.create({
        data: {
          portefeuilleId: wallet.id,
          type: 'GAIN',
          montant: pointsEarned,
          description: `Bonne réponse QCM - ${question.difficulte}`,
        },
      });
    }
  }

  return {
    correct,
    correctIndex: question.correctIndex,
    explication: question.explication || '',
    pointsEarned,
    tempsReponse,
  };
}

// Fallback questions if AI generation fails
function getFallbackQuestions(thematique: string, count: number): GeneratedQuestion[] {
  const fallbackQuestions: GeneratedQuestion[] = [
    {
      question: "Quelle est la montagne la plus haute du Maroc?",
      options: ["Jbel Toubkal", "Jbel Mgoun", "Jbel Ayachi", "Jbel Sirwa"],
      correctIndex: 0,
      explication: "Le Jbel Toubkal culmine à 4167m, c'est le plus haut sommet du Maroc et de l'Afrique du Nord.",
      difficulte: 'FACILE',
    },
    {
      question: "Combien de litres d'eau minimum faut-il prévoir par personne pour une randonnée d'une journée?",
      options: ["0.5 litre", "1 litre", "2 litres", "3 litres"],
      correctIndex: 2,
      explication: "Il est recommandé de prévoir au minimum 2 litres d'eau par personne pour une journée de randonnée.",
      difficulte: 'FACILE',
    },
    {
      question: "Que signifie le balisage rouge et blanc en randonnée?",
      options: ["Sentier de grande randonnée (GR)", "Chemin interdit", "Zone dangereuse", "Propriété privée"],
      correctIndex: 0,
      explication: "Le balisage rouge et blanc indique un sentier de Grande Randonnée (GR).",
      difficulte: 'MOYEN',
    },
    {
      question: "Quelle est la meilleure période pour randonner dans l'Atlas?",
      options: ["Décembre-Janvier", "Avril-Juin et Septembre-Octobre", "Juillet-Août", "Novembre"],
      correctIndex: 1,
      explication: "Le printemps et l'automne offrent les meilleures conditions: températures agréables et peu de neige.",
      difficulte: 'MOYEN',
    },
    {
      question: "En cas d'orage en montagne, quelle est la bonne attitude?",
      options: [
        "Se réfugier sous un arbre isolé",
        "Rester debout et courir vers le sommet",
        "S'accroupir, pieds joints, loin des crêtes et arbres isolés",
        "S'allonger au sol"
      ],
      correctIndex: 2,
      explication: "S'accroupir en position de sécurité, pieds joints, réduit les risques de foudroiement.",
      difficulte: 'DIFFICILE',
    },
  ];

  return fallbackQuestions.slice(0, count);
}

// Create questions for a new session
export async function createSessionQuestions(
  sessionId: string,
  thematique: string,
  niveau: string,
  count: number = 10
): Promise<void> {
  const questions = await generateQCMQuestions(thematique, niveau, count);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await prisma.question.create({
      data: {
        sessionId,
        question: q.question,
        options: q.options,
        correctIndex: q.correctIndex,
        explication: q.explication,
        difficulte: q.difficulte,
        ordre: i + 1,
      },
    });
  }
}
