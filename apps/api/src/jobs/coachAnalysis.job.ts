import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import {
  analyserSessionIndividuelle,
  analyserSessionCollective,
} from '../services/coachIAService';

const prisma = new PrismaClient();

// ── analyserSessionsRecentes ──────────────────────────────────
// Analyse les sessions complétées il y a ~2h et non encore analysées
async function analyserSessionsRecentes() {
  const deuxHeuresPassees = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const troisHeuresPassees = new Date(Date.now() - 3 * 60 * 60 * 1000);

  // Sessions complétées dans la fenêtre [3h, 2h] — pas encore trop vieilles
  const sessions = await prisma.session.findMany({
    where: {
      status: 'completed',
      completedAt: {
        gte: troisHeuresPassees,
        lte: deuxHeuresPassees,
      },
    },
    include: {
      sessionGroupes: {
        include: {
          groupe: { include: { membres: true } },
        },
      },
    },
  });

  for (const session of sessions) {
    console.log(`[COACH] Analyse session ${session.id}...`);

    for (const sg of session.sessionGroupes) {
      // Analyser chaque membre du groupe
      for (const membre of sg.groupe.membres) {
        // Vérifier si déjà analysé
        const dejaAnalyse = await prisma.coachIASession.findFirst({
          where: { userId: membre.userId, sessionId: session.id },
        });
        if (dejaAnalyse) continue;

        try {
          await analyserSessionIndividuelle(membre.userId, session.id);
          console.log(`  ✓ Analyse individuelle : ${membre.userId}`);
        } catch (err: any) {
          console.error(`  ✗ Erreur analyse individuelle ${membre.userId}:`, err.message);
        }
      }

      // Analyse collective du groupe
      try {
        await analyserSessionCollective(sg.groupeId, session.id);
        console.log(`  ✓ Analyse collective : ${sg.groupeId}`);
      } catch (err: any) {
        console.error(`  ✗ Erreur analyse collective ${sg.groupeId}:`, err.message);
      }
    }
  }

  if (sessions.length === 0) {
    console.log('[COACH] Aucune session à analyser');
  }
}

// ── startCoachAnalysisJob ─────────────────────────────────────
export function startCoachAnalysisJob() {
  // Toutes les 30 minutes — vérifie si une session doit être analysée
  cron.schedule('*/30 * * * *', async () => {
    console.log('[COACH] Vérification sessions à analyser...');
    await analyserSessionsRecentes().catch(console.error);
  }, { timezone: 'Africa/Casablanca' });

  console.log('✅ Job Coach IA planifié — toutes les 30 minutes');
}
