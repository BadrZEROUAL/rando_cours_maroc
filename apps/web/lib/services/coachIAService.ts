import Anthropic from '@anthropic-ai/sdk';
import prisma from '@/lib/prisma';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface AnalyseIndividuelle {
  userId: string;
  forces: string[];
  faiblesses: string[];
  recommandations: string[];
  scoreGlobal: number;
  progression: string;
}

interface AnalyseCollective {
  groupeId: string;
  dynamiqueEquipe: string;
  pointsForts: string[];
  pointsAmelioration: string[];
  recommandations: string[];
  scoreCollectif: number;
}

interface JumeauNumerique {
  profil: string;
  styleApprentissage: string;
  motivations: string[];
  defis: string[];
  parcoursSuggere: string[];
}

// Analyse individuelle d'un élève
export async function analyserEleve(userId: string, sessionId?: string): Promise<AnalyseIndividuelle> {
  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      groupeMembres: {
        include: {
          groupe: {
            include: {
              sessionGroupes: {
                include: {
                  reponses: {
                    include: { question: true },
                  },
                  session: true,
                },
                orderBy: { session: { createdAt: 'desc' } },
                take: 10,
              },
            },
          },
        },
      },
      wallet: true,
      badges: true,
    },
  });

  if (!user) {
    throw new Error('Utilisateur non trouvé');
  }

  // Aggregate responses from all user's groups
  const allReponses = user.groupeMembres.flatMap((gm) =>
    gm.groupe.sessionGroupes.flatMap((sg) => sg.reponses)
  );
  
  const bonnesReponses = allReponses.filter((r) => r.correct);
  const tauxReussite = allReponses.length > 0 
    ? (bonnesReponses.length / allReponses.length) * 100 
    : 0;

  // Build prompt for Claude
  const prompt = `Tu es un coach pédagogique spécialisé en éducation au Maroc.
Analyse les performances de cet élève et fournis une analyse personnalisée.

Données de l'élève:
- Email: ${user.email}
- Rôle: ${user.role}
- Nombre de groupes: ${user.groupeMembres.length}
- Total réponses: ${allReponses.length}
- Bonnes réponses: ${bonnesReponses.length}
- Taux de réussite: ${tauxReussite.toFixed(1)}%
- Badges obtenus: ${user.badges.length}
- Solde RC: ${user.wallet?.soldeRc || 0}

Fournis une analyse JSON avec ce format:
{
  "forces": ["...", "..."],
  "faiblesses": ["...", "..."],
  "recommandations": ["...", "..."],
  "scoreGlobal": 75,
  "progression": "Description de la progression..."
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Get the first group for saving (or use provided sessionId context)
    const firstGroupeId = user.groupeMembres[0]?.groupeId;
    
    if (firstGroupeId && sessionId) {
      // Save analysis to database using CoachIASession
      await prisma.coachIASession.create({
        data: {
          userId,
          groupeId: firstGroupeId,
          sessionId,
          lacunes: analysis.faiblesses || [],
          exercices: analysis.recommandations || [],
          messageEncouragement: analysis.progression || 'Continue ainsi!',
          patternCommun: false,
        },
      });
    }

    return {
      userId,
      ...analysis,
    };
  } catch (error) {
    console.error('Error in analyserEleve:', error);
    // Return fallback analysis
    return {
      userId,
      forces: ['Participation régulière', 'Motivation'],
      faiblesses: ['Questions difficiles à améliorer'],
      recommandations: ['Continuer à pratiquer', 'Réviser les thématiques difficiles'],
      scoreGlobal: Math.round(tauxReussite),
      progression: 'En progression constante',
    };
  }
}

// Analyse collective d'un groupe
export async function analyserGroupe(groupeId: string, sessionId?: string): Promise<AnalyseCollective> {
  const groupe = await prisma.groupe.findUnique({
    where: { id: groupeId },
    include: {
      membres: {
        include: {
          user: true,
        },
      },
      sessionGroupes: {
        include: {
          reponses: true,
          session: true,
        },
        orderBy: { session: { createdAt: 'desc' } },
        take: 10,
      },
    },
  });

  if (!groupe) {
    throw new Error('Groupe non trouvé');
  }

  // Calculate group statistics
  const allReponses = groupe.sessionGroupes.flatMap((sg) => sg.reponses);
  const bonnesReponses = allReponses.filter((r) => r.correct);
  const tauxReussite = allReponses.length > 0
    ? (bonnesReponses.length / allReponses.length) * 100
    : 0;

  const totalScore = groupe.sessionGroupes.reduce((sum, sg) => sum + sg.scoreQcm + sg.scoreValidation, 0);
  const totalRc = groupe.sessionGroupes.reduce((sum, sg) => sum + sg.randoCoins, 0);

  const prompt = `Tu es un coach pédagogique spécialisé en dynamique de groupe.
Analyse les performances collectives de ce groupe d'élèves.

Données du groupe "${groupe.nom}":
- Emoji: ${groupe.logoEmoji}
- Slogan: ${groupe.slogan || 'Non défini'}
- Niveau: ${groupe.niveauActuel}
- Nombre de membres: ${groupe.membres.length}
- Sessions participées: ${groupe.sessionGroupes.length}
- Total réponses: ${allReponses.length}
- Bonnes réponses: ${bonnesReponses.length}
- Taux de réussite: ${tauxReussite.toFixed(1)}%
- Score total: ${totalScore}
- RandoCoins gagnés: ${totalRc}

Fournis une analyse JSON avec ce format:
{
  "dynamiqueEquipe": "Description de la dynamique...",
  "pointsForts": ["...", "..."],
  "pointsAmelioration": ["...", "..."],
  "recommandations": ["...", "..."],
  "scoreCollectif": 75
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Save analysis if we have a session context
    if (sessionId) {
      const firstMember = groupe.membres[0];
      if (firstMember) {
        await prisma.coachIASession.create({
          data: {
            userId: firstMember.userId,
            groupeId,
            sessionId,
            lacunes: analysis.pointsAmelioration || [],
            exercices: analysis.recommandations || [],
            messageEncouragement: analysis.dynamiqueEquipe || 'Continuez votre excellent travail!',
            patternCommun: true, // This is a group analysis
          },
        });
      }
    }

    return {
      groupeId,
      ...analysis,
    };
  } catch (error) {
    console.error('Error in analyserGroupe:', error);
    return {
      groupeId,
      dynamiqueEquipe: 'Bonne cohésion de groupe',
      pointsForts: ['Collaboration', 'Entraide'],
      pointsAmelioration: ['Communication', 'Régularité'],
      recommandations: ['Organiser plus de sessions collectives'],
      scoreCollectif: Math.round(tauxReussite),
    };
  }
}

// Générer un jumeau numérique
export async function genererJumeauNumerique(groupeId: string): Promise<JumeauNumerique> {
  const groupe = await prisma.groupe.findUnique({
    where: { id: groupeId },
    include: {
      membres: {
        include: {
          user: {
            include: {
              badges: true,
            },
          },
        },
      },
      sessionGroupes: {
        include: {
          reponses: {
            include: { question: true },
          },
          session: true,
        },
      },
    },
  });

  if (!groupe) {
    throw new Error('Groupe non trouvé');
  }

  // Aggregate group data
  const allReponses = groupe.sessionGroupes.flatMap((sg) => sg.reponses);
  const matieres = [...new Set(groupe.sessionGroupes.map((sg) => sg.session.matiere))];

  const prompt = `Tu es un expert en modélisation de profils d'apprentissage.
Crée un "jumeau numérique" représentant le profil collectif de ce groupe d'élèves.

Données du groupe:
- Nom: ${groupe.nom}
- Niveau: ${groupe.niveauActuel}
- Membres: ${groupe.membres.length}
- Matières abordées: ${matieres.join(', ')}
- Total réponses: ${allReponses.length}
- Réponses correctes: ${allReponses.filter((r) => r.correct).length}

Génère un profil JSON représentant ce groupe:
{
  "profil": "Description du profil type...",
  "styleApprentissage": "Description du style...",
  "motivations": ["...", "..."],
  "defis": ["...", "..."],
  "parcoursSuggere": ["Étape 1...", "Étape 2...", "..."]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found');
    }

    return JSON.parse(jsonMatch[0]) as JumeauNumerique;
  } catch (error) {
    console.error('Error in genererJumeauNumerique:', error);
    return {
      profil: 'Groupe d\'élèves motivés en apprentissage',
      styleApprentissage: 'Apprentissage par la pratique et le jeu',
      motivations: ['Réussite scolaire', 'Esprit d\'équipe', 'Défi personnel'],
      defis: ['Progression technique', 'Gestion du temps'],
      parcoursSuggere: [
        'Maîtriser les bases de chaque matière',
        'Approfondir les points faibles identifiés',
        'Participer à des sessions de niveau supérieur',
      ],
    };
  }
}

// Get coaching history for a user
export async function getCoachingHistory(userId: string) {
  const analyses = await prisma.coachIASession.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  return analyses;
}
