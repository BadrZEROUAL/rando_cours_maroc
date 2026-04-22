import { PrismaClient, Role, Langue, Niveau, Matiere } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du seed RandoCours Maroc...');

  // ── Établissement de test ──────────────────────────────────
  const etablissement = await prisma.etablissement.upsert({
    where: { id: 'etab-001-seed' },
    update: {},
    create: {
      id: 'etab-001-seed',
      nom: 'Lycée Ibn Khaldoun',
      type: 'Lycée',
      ville: 'Fès',
      region: 'Fès-Meknès',
      licenceActive: true,
    },
  });
  console.log('✓ Établissement créé:', etablissement.nom);

  // ── Utilisateurs de test ───────────────────────────────────
  // Note : en production, les users sont créés via Supabase Auth
  // Ici on crée les entrées DB directement pour le seed

  const admin = await prisma.user.upsert({
    where: { email: 'admin@randocours.ma' },
    update: {},
    create: {
      id: 'user-admin-seed',
      email: 'admin@randocours.ma',
      role: Role.admin,
      langue: Langue.fr,
      isMineur: false,
      consentementParent: true,
      estActif: true,
    },
  });

  const enseignant = await prisma.user.upsert({
    where: { email: 'prof.maths@lycee-ibnkhaldoun.ma' },
    update: {},
    create: {
      id: 'user-enseignant-seed',
      email: 'prof.maths@lycee-ibnkhaldoun.ma',
      role: Role.enseignant,
      langue: Langue.fr,
      isMineur: false,
      consentementParent: true,
      estActif: true,
    },
  });

  // Élèves de test
  const eleves = await Promise.all([
    { id: 'user-eleve-1', email: 'amina@eleve.ma', prenom: 'Amina' },
    { id: 'user-eleve-2', email: 'bilal@eleve.ma', prenom: 'Bilal' },
    { id: 'user-eleve-3', email: 'fatima@eleve.ma', prenom: 'Fatima' },
    { id: 'user-eleve-4', email: 'youssef@eleve.ma', prenom: 'Youssef' },
  ].map(e =>
    prisma.user.upsert({
      where: { email: e.email },
      update: {},
      create: {
        id: e.id,
        email: e.email,
        role: Role.eleve,
        langue: Langue.fr,
        isMineur: false,
        consentementParent: true,
        estActif: true,
      },
    })
  ));

  console.log(`✓ ${eleves.length + 2} utilisateurs créés`);

  // ── Wallets ────────────────────────────────────────────────
  await Promise.all([admin, enseignant, ...eleves].map(u =>
    prisma.wallet.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        soldeRc: BigInt(u.role === 'admin' ? 99999 : 100),
        capitalInvestiDh: 0,
      },
    })
  ));
  console.log('✓ Wallets initialisés (100 RC chacun)');

  // ── Groupe de test ─────────────────────────────────────────
  const groupe = await prisma.groupe.upsert({
    where: { id: 'groupe-alpha-seed' },
    update: {},
    create: {
      id: 'groupe-alpha-seed',
      nom: 'Les Algorithmes',
      logoEmoji: '🤖',
      slogan: 'Pensez, débattez, créez !',
      niveauActuel: Niveau.BAC2_SMA,
      etablissementId: etablissement.id,
      coachId: enseignant.id,
    },
  });

  // Membres du groupe
  for (const eleve of eleves) {
    await prisma.groupeMembre.upsert({
      where: { groupeId_userId: { groupeId: groupe.id, userId: eleve.id } },
      update: {},
      create: { groupeId: groupe.id, userId: eleve.id },
    });
  }

  // Compte collectif du groupe
  await prisma.compteCollectif.upsert({
    where: { groupeId: groupe.id },
    update: {},
    create: {
      groupeId: groupe.id,
      soldeRc: BigInt(400), // 4 membres × 100 RC initial
      bloque: false,
    },
  });

  // Cotisation initiale
  const prochainMois = new Date();
  prochainMois.setMonth(prochainMois.getMonth() + 1);

  await prisma.cotisation.create({
    data: {
      groupeId: groupe.id,
      montantDh: 30,
      dueAt: prochainMois,
      isPaid: false,
    },
  }).catch(() => {}); // Ignore si déjà créée

  console.log('✓ Groupe "Les Algorithmes" créé avec 4 membres');

  // ── Session de démo ────────────────────────────────────────
  const sessionDemo = await prisma.session.upsert({
    where: { id: 'session-demo-seed' },
    update: {},
    create: {
      id: 'session-demo-seed',
      niveau: Niveau.BAC2_SMA,
      matiere: Matiere.Maths,
      theme: 'Intelligence Artificielle',
      difficulte: 3,
      nbGroupes: 1,
      nbHallucinations: 1,
      status: 'configured',
      enseignantId: enseignant.id,
      messageSecret: 'LESMATHSSONTPARTOUT',
    },
  });

  // Lier le groupe à la session
  await prisma.sessionGroupe.upsert({
    where: { sessionId_groupeId: { sessionId: sessionDemo.id, groupeId: groupe.id } },
    update: {},
    create: {
      sessionId: sessionDemo.id,
      groupeId: groupe.id,
      scoreQcm: 0,
      scoreValidation: 0,
      randoCoins: 100,
    },
  });

  console.log('✓ Session démo "Maths × IA" configurée (prête pour génération)');

  console.log('\n🎉 Seed terminé avec succès !');
  console.log('\nComptes disponibles :');
  console.log('  Admin      : admin@randocours.ma');
  console.log('  Enseignant : prof.maths@lycee-ibnkhaldoun.ma');
  console.log('  Élèves     : amina@eleve.ma, bilal@eleve.ma, ...');
  console.log('\nNote : Les mots de passe sont gérés par Supabase Auth.');
  console.log('Créez ces comptes manuellement dans votre dashboard Supabase.');
}

main()
  .catch(e => { console.error('❌ Seed échoué:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
