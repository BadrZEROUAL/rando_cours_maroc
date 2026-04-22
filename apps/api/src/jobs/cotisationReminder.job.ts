import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MTARGET_URL = process.env.MTARGET_API_URL || 'https://api.mtarget.ma/v2/messages';
const MTARGET_KEY = process.env.MTARGET_API_KEY!;
const MTARGET_SENDER = process.env.MTARGET_SENDER || 'RANDOCOURS';

// ── sendSMS ───────────────────────────────────────────────────
async function sendSMS(telephone: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(MTARGET_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MTARGET_KEY}`,
      },
      body: JSON.stringify({ to: telephone, message, from: MTARGET_SENDER }),
    });
    return res.ok;
  } catch (err) {
    console.error('[SMS] Échec envoi:', err);
    return false;
  }
}

// ── checkCotisations ──────────────────────────────────────────
async function checkCotisations() {
  const now = new Date();
  const j7 = new Date(now); j7.setDate(j7.getDate() + 7);
  const j1 = new Date(now); j1.setDate(j1.getDate() + 1);
  const hier = new Date(now); hier.setDate(hier.getDate() - 1);
  const il_y_a_7j = new Date(now); il_y_a_7j.setDate(il_y_a_7j.getDate() - 7);

  // 1. Rappel J-7
  const cotisationsJ7 = await prisma.cotisation.findMany({
    where: {
      isPaid: false,
      rappelJ7: false,
      dueAt: { gte: now, lte: j7 },
    },
    include: { groupe: { include: { membres: { include: { user: true } } } } },
  });

  for (const c of cotisationsJ7) {
    const coach = c.groupe.membres[0]?.user;
    if (coach?.telephone) {
      const ok = await sendSMS(
        coach.telephone,
        `RandoCours : La cotisation du groupe ${c.groupe.nom} est due dans 7 jours (${c.montantDh} DH). Réglez-la sur l'application.`
      );
      if (ok) await prisma.cotisation.update({ where: { id: c.id }, data: { rappelJ7: true } });
    }
  }

  // 2. Rappel J-1
  const cotisationsJ1 = await prisma.cotisation.findMany({
    where: {
      isPaid: false,
      rappelJ1: false,
      dueAt: { gte: now, lte: j1 },
    },
    include: { groupe: { include: { membres: { include: { user: true } } } } },
  });

  for (const c of cotisationsJ1) {
    const coach = c.groupe.membres[0]?.user;
    if (coach?.telephone) {
      const ok = await sendSMS(
        coach.telephone,
        `URGENT - RandoCours : Cotisation groupe ${c.groupe.nom} due DEMAIN. Payez maintenant pour éviter le blocage.`
      );
      if (ok) await prisma.cotisation.update({ where: { id: c.id }, data: { rappelJ1: true } });
    }
  }

  // 3. Dépassée hier → SMS de grâce
  const cotisationsGrace = await prisma.cotisation.findMany({
    where: {
      isPaid: false,
      bloqueAt: null,
      dueAt: { gte: il_y_a_7j, lte: hier },
    },
    include: { groupe: { include: { membres: { include: { user: true } } } } },
  });

  for (const c of cotisationsGrace) {
    const coach = c.groupe.membres[0]?.user;
    if (coach?.telephone) {
      await sendSMS(
        coach.telephone,
        `RandoCours : Cotisation groupe ${c.groupe.nom} en retard. Payez dans les 7 jours pour éviter le blocage définitif.`
      );
    }
  }

  // 4. Dépassée de 7 jours → bloquer le compte
  const cotisationsBloc = await prisma.cotisation.findMany({
    where: {
      isPaid: false,
      bloqueAt: null,
      dueAt: { lte: il_y_a_7j },
    },
    include: { groupe: true },
  });

  for (const c of cotisationsBloc) {
    await prisma.$transaction([
      prisma.cotisation.update({ where: { id: c.id }, data: { bloqueAt: now } }),
      prisma.compteCollectif.update({
        where: { groupeId: c.groupeId },
        data: { bloque: true },
      }),
    ]);
    console.log(`[COTISATION] Groupe ${c.groupe.nom} bloqué pour cotisation impayée`);
  }

  console.log(`[COTISATION] Check terminé — ${new Date().toISOString()}`);
}

// ── Planification du job ──────────────────────────────────────
export function startCotisationJob() {
  // Chaque jour à 9h00
  cron.schedule('0 9 * * *', async () => {
    console.log('[COTISATION] Démarrage check quotidien');
    await checkCotisations().catch(console.error);
  }, { timezone: 'Africa/Casablanca' });

  console.log('✅ Job cotisations planifié — tous les jours à 9h (Casablanca)');
}
