import { put } from '@vercel/blob';
import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Matiere } from '@prisma/client';

const QR_JWT_SECRET = process.env.QR_JWT_SECRET || 'qr-secret-key';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://randocours.ma';

interface BadgeData {
  eleveId: string;
  groupeId: string;
  sessionId: string;
  niveau: number; // 1-5 stars
  matiere: Matiere;
  score: number;
  scoreMax: number;
  competencesValidees: string[];
}

// Generate a badge/certificate for a user
export async function generateBadge(data: BadgeData): Promise<{
  badgeId: string;
  certificateUrl: string;
  qrCodeUrl: string;
}> {
  // Create badge in database
  const badge = await prisma.badge.create({
    data: {
      eleveId: data.eleveId,
      groupeId: data.groupeId,
      sessionId: data.sessionId,
      niveau: data.niveau,
      matiere: data.matiere,
      score: data.score,
      scoreMax: data.scoreMax,
      competencesValidees: data.competencesValidees,
    },
  });

  // Generate QR code for verification
  const verificationUrl = `${APP_URL}/verify/badge/${badge.id}`;
  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 200,
  });

  // Generate PDF certificate
  const pdfBytes = await generateCertificatePDF(badge, data, qrCodeDataUrl);

  // Upload to Vercel Blob
  const { url: pdfUrl } = await put(
    `certificates/${badge.id}.pdf`,
    pdfBytes,
    { access: 'public', contentType: 'application/pdf' }
  );

  // Generate Open Badge JSON
  const badgeJson = {
    '@context': 'https://w3id.org/openbadges/v2',
    type: 'Assertion',
    id: `${APP_URL}/api/v1/badges/${badge.id}/json`,
    recipient: {
      type: 'email',
      identity: `sha256$${badge.eleveId}`,
      hashed: true,
    },
    badge: {
      type: 'BadgeClass',
      id: `${APP_URL}/api/v1/badges/class/${data.matiere}`,
      name: `Badge ${data.matiere} - Niveau ${data.niveau}`,
      description: `Badge obtenu avec un score de ${data.score}/${data.scoreMax}`,
      image: `${APP_URL}/badges/${data.matiere.toLowerCase()}.png`,
      criteria: {
        narrative: `Score minimum de ${Math.round((data.score / data.scoreMax) * 100)}% requis`,
      },
      issuer: {
        id: `${APP_URL}/issuer`,
        type: 'Issuer',
        name: 'RandoCours Maroc',
        url: APP_URL,
      },
    },
    issuedOn: badge.issuedOn.toISOString(),
    verification: {
      type: 'hosted',
    },
  };

  const { url: badgeJsonUrl } = await put(
    `badges/${badge.id}.json`,
    JSON.stringify(badgeJson),
    { access: 'public', contentType: 'application/json' }
  );

  // Update badge with URLs
  await prisma.badge.update({
    where: { id: badge.id },
    data: {
      pdfUrl,
      badgeJsonUrl,
    },
  });

  return {
    badgeId: badge.id,
    certificateUrl: pdfUrl,
    qrCodeUrl: qrCodeDataUrl,
  };
}

// Generate PDF certificate
async function generateCertificatePDF(
  badge: { id: string; issuedOn: Date; niveau: number },
  data: BadgeData,
  qrCodeDataUrl: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size

  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const { width, height } = page.getSize();

  // Color based on niveau (stars)
  const niveauColors: Record<number, ReturnType<typeof rgb>> = {
    1: rgb(0.8, 0.5, 0.2),   // Bronze
    2: rgb(0.75, 0.75, 0.75), // Silver
    3: rgb(1, 0.84, 0),       // Gold
    4: rgb(0.9, 0.89, 0.88),  // Platinum
    5: rgb(0.58, 0.0, 0.83),  // Diamond (purple)
  };

  const borderColor = niveauColors[badge.niveau] || niveauColors[1];

  // Border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor,
    borderWidth: 3,
  });

  // Title
  page.drawText('CERTIFICAT DE REUSSITE', {
    x: width / 2 - 140,
    y: height - 100,
    size: 28,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // RandoCours logo text
  page.drawText('RandoCours Maroc', {
    x: width / 2 - 80,
    y: height - 140,
    size: 18,
    font: helvetica,
    color: rgb(0.2, 0.5, 0.3),
  });

  // Get user info
  const user = await prisma.user.findUnique({
    where: { id: data.eleveId },
  });

  page.drawText('Ce certificat atteste que', {
    x: width / 2 - 90,
    y: height - 220,
    size: 14,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  page.drawText(user?.email || 'Participant', {
    x: width / 2 - 80,
    y: height - 260,
    size: 20,
    font: helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  page.drawText('a obtenu le badge', {
    x: width / 2 - 60,
    y: height - 310,
    size: 14,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Stars for niveau
  const stars = '★'.repeat(badge.niveau) + '☆'.repeat(5 - badge.niveau);
  page.drawText(stars, {
    x: width / 2 - 40,
    y: height - 350,
    size: 24,
    font: helvetica,
    color: borderColor,
  });

  // Matiere
  page.drawText(data.matiere.replace('_', ' '), {
    x: width / 2 - 60,
    y: height - 390,
    size: 22,
    font: helveticaBold,
    color: borderColor,
  });

  // Score
  const percentage = Math.round((data.score / data.scoreMax) * 100);
  page.drawText(`Score: ${data.score}/${data.scoreMax} (${percentage}%)`, {
    x: width / 2 - 80,
    y: height - 440,
    size: 16,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  // Competences
  if (data.competencesValidees.length > 0) {
    page.drawText('Competences validees:', {
      x: 60,
      y: height - 490,
      size: 12,
      font: helveticaBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    data.competencesValidees.slice(0, 4).forEach((comp, i) => {
      page.drawText(`• ${comp}`, {
        x: 70,
        y: height - 510 - i * 18,
        size: 11,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
    });
  }

  // Date
  const dateStr = badge.issuedOn.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  page.drawText(`Delivre le ${dateStr}`, {
    x: width / 2 - 70,
    y: 180,
    size: 12,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });

  // QR Code
  const qrImageBytes = await fetch(qrCodeDataUrl).then((res) => res.arrayBuffer());
  const qrImage = await pdfDoc.embedPng(qrImageBytes);
  page.drawImage(qrImage, {
    x: width / 2 - 50,
    y: 60,
    width: 100,
    height: 100,
  });

  page.drawText('Scannez pour verifier', {
    x: width / 2 - 55,
    y: 45,
    size: 10,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  // Certificate ID
  page.drawText(`ID: ${badge.id}`, {
    x: 40,
    y: 30,
    size: 8,
    font: helvetica,
    color: rgb(0.6, 0.6, 0.6),
  });

  return pdfDoc.save();
}

// Verify a badge
export async function verifyBadge(badgeId: string): Promise<{
  valid: boolean;
  badge?: {
    id: string;
    niveau: number;
    matiere: string;
    score: number;
    scoreMax: number;
    userName: string;
    groupeName: string;
    issuedOn: Date;
    revoque: boolean;
  };
  message?: string;
}> {
  const badge = await prisma.badge.findUnique({
    where: { id: badgeId },
    include: {
      eleve: { select: { email: true } },
      groupe: { select: { nom: true } },
    },
  });

  if (!badge) {
    return { valid: false, message: 'Badge non trouve' };
  }

  if (badge.revoque) {
    return { valid: false, message: 'Ce badge a ete revoque' };
  }

  return {
    valid: true,
    badge: {
      id: badge.id,
      niveau: badge.niveau,
      matiere: badge.matiere,
      score: badge.score,
      scoreMax: badge.scoreMax,
      userName: badge.eleve.email,
      groupeName: badge.groupe.nom,
      issuedOn: badge.issuedOn,
      revoque: badge.revoque,
    },
  };
}

// Get user badges
export async function getUserBadges(userId: string) {
  const badges = await prisma.badge.findMany({
    where: { eleveId: userId, revoque: false },
    include: {
      groupe: { select: { nom: true, logoEmoji: true } },
    },
    orderBy: { issuedOn: 'desc' },
  });

  return badges.map((b) => ({
    id: b.id,
    niveau: b.niveau,
    matiere: b.matiere,
    score: b.score,
    scoreMax: b.scoreMax,
    percentage: Math.round((b.score / b.scoreMax) * 100),
    groupeNom: b.groupe.nom,
    groupeEmoji: b.groupe.logoEmoji,
    competences: b.competencesValidees,
    pdfUrl: b.pdfUrl,
    issuedOn: b.issuedOn,
  }));
}

// Generate badge based on session performance
export async function generateSessionBadge(
  sessionId: string,
  userId: string
): Promise<{
  eligible: boolean;
  niveau?: number;
  badge?: Awaited<ReturnType<typeof generateBadge>>;
}> {
  // Get session with group participation
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      sessionGroupes: {
        include: {
          groupe: {
            include: {
              membres: {
                where: { userId },
              },
            },
          },
          reponses: true,
        },
      },
    },
  });

  if (!session) {
    return { eligible: false };
  }

  // Find the user's group participation
  const userSessionGroupe = session.sessionGroupes.find(
    (sg) => sg.groupe.membres.length > 0
  );

  if (!userSessionGroupe) {
    return { eligible: false };
  }

  const totalReponses = userSessionGroupe.reponses.length;
  const correctReponses = userSessionGroupe.reponses.filter((r) => r.correct).length;
  const percentage = totalReponses > 0 ? (correctReponses / totalReponses) * 100 : 0;

  // Determine niveau (stars) based on score
  let niveau: number | null = null;
  if (percentage >= 95) {
    niveau = 5;
  } else if (percentage >= 80) {
    niveau = 4;
  } else if (percentage >= 60) {
    niveau = 3;
  } else if (percentage >= 40) {
    niveau = 2;
  } else if (percentage >= 20) {
    niveau = 1;
  }

  if (!niveau) {
    return { eligible: false };
  }

  // Check if badge already exists for this session
  const existingBadge = await prisma.badge.findFirst({
    where: { eleveId: userId, sessionId },
  });

  if (existingBadge) {
    return { eligible: false };
  }

  // Determine competences based on performance
  const competences: string[] = [];
  if (percentage >= 60) competences.push('Maitrise des fondamentaux');
  if (percentage >= 80) competences.push('Pensee critique');
  if (userSessionGroupe.groupe.membres.length > 1) competences.push('Travail en equipe');
  if (totalReponses >= 15) competences.push('Perseverance');

  // Generate badge
  const badge = await generateBadge({
    eleveId: userId,
    groupeId: userSessionGroupe.groupeId,
    sessionId,
    niveau,
    matiere: session.matiere,
    score: userSessionGroupe.scoreQcm + userSessionGroupe.scoreValidation,
    scoreMax: totalReponses * 20, // Assuming 20 points max per question
    competencesValidees: competences,
  });

  return {
    eligible: true,
    niveau,
    badge,
  };
}
