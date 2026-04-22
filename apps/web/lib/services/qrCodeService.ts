import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import prisma from '@/lib/prisma';
import { TransactionType } from '@prisma/client';

const QR_JWT_SECRET = process.env.QR_JWT_SECRET || 'qr-secret-key';

interface QRPayload {
  sessionId: string;
  groupeId: string;
  stationNum: number;
  lieuNom: string;
  exp: number;
}

// Generate QR code for a station
export async function generateStationQR(
  sessionId: string,
  groupeId: string,
  stationNum: number,
  lieuNom: string,
  expiresInMinutes: number = 60
): Promise<{ qrDataUrl: string; token: string; qrCodeId: string }> {
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  
  const payload: QRPayload = {
    sessionId,
    groupeId,
    stationNum,
    lieuNom,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  const token = jwt.sign(payload, QR_JWT_SECRET);
  
  // Save QR code in database
  const qrCode = await prisma.qRCode.create({
    data: {
      sessionId,
      groupeId,
      stationNum,
      lieuNom,
      token,
      expiresAt,
    },
  });

  const qrDataUrl = await QRCode.toDataURL(token, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 256,
  });

  return { qrDataUrl, token, qrCodeId: qrCode.id };
}

// Verify and decode QR code token
export function verifyQRToken(token: string): QRPayload | null {
  try {
    const decoded = jwt.verify(token, QR_JWT_SECRET) as QRPayload;
    return decoded;
  } catch {
    return null;
  }
}

// Scan and validate QR code
export async function scanQRCode(
  token: string,
  groupeId: string
): Promise<{
  success: boolean;
  stationNum?: number;
  lieuNom?: string;
  rcGained?: number;
  message?: string;
}> {
  const payload = verifyQRToken(token);

  if (!payload) {
    return { success: false, message: 'QR code invalide ou expiré' };
  }

  // Check if QR code has expired
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return { success: false, message: 'QR code expiré' };
  }

  // Check if this is the correct group
  if (payload.groupeId !== groupeId) {
    return { success: false, message: 'Ce QR code appartient à un autre groupe' };
  }

  // Get QR code from database
  const qrCode = await prisma.qRCode.findUnique({
    where: { token },
  });

  if (!qrCode) {
    return { success: false, message: 'QR code non trouvé' };
  }

  if (qrCode.isUtilise) {
    return { success: false, message: 'Ce QR code a déjà été utilisé' };
  }

  // Mark QR code as used
  await prisma.qRCode.update({
    where: { id: qrCode.id },
    data: {
      isUtilise: true,
      utiliseAt: new Date(),
    },
  });

  // Award RC to group's collective account
  const rcGained = 50; // Base RC for scanning a station QR

  const compte = await prisma.compteCollectif.findUnique({
    where: { groupeId },
  });

  if (compte) {
    await prisma.compteCollectif.update({
      where: { id: compte.id },
      data: { soldeRc: { increment: BigInt(rcGained) } },
    });

    await prisma.transaction.create({
      data: {
        type: TransactionType.BONUS_CORRECT,
        sourceId: qrCode.sessionId,
        destId: compte.id,
        montantRc: BigInt(rcGained),
        metadata: { 
          stationNum: qrCode.stationNum, 
          lieuNom: qrCode.lieuNom,
          qrCodeId: qrCode.id 
        },
      },
    });
  }

  return {
    success: true,
    stationNum: qrCode.stationNum,
    lieuNom: qrCode.lieuNom,
    rcGained,
    message: `+${rcGained} RC gagnés à la station ${qrCode.lieuNom}!`,
  };
}

// Detect code sharing between groups (anti-cheat)
export async function detecterPartageCode(
  sessionId: string,
  groupeId: string,
  stationNum: number,
  codeStation: string
): Promise<{ partageDetecte: boolean; groupesFraudeurs?: string[] }> {
  // Check if another group used this exact code pattern in a suspicious timeframe
  const recentScans = await prisma.qRCode.findMany({
    where: {
      sessionId,
      stationNum,
      isUtilise: true,
      utiliseAt: {
        gte: new Date(Date.now() - 5 * 60 * 1000), // Last 5 minutes
      },
    },
    select: {
      groupeId: true,
      utiliseAt: true,
    },
  });

  // If multiple groups used the same station in quick succession, flag as suspicious
  const otherGroups = recentScans
    .filter((s) => s.groupeId !== groupeId)
    .map((s) => s.groupeId);

  if (otherGroups.length > 0) {
    // Apply penalty for code sharing
    const compte = await prisma.compteCollectif.findUnique({
      where: { groupeId },
    });

    if (compte) {
      const penalite = 30; // RC penalty for suspected sharing
      await prisma.compteCollectif.update({
        where: { id: compte.id },
        data: { soldeRc: { decrement: BigInt(penalite) } },
      });

      await prisma.transaction.create({
        data: {
          type: TransactionType.PENALITE_PARTAGE,
          sourceId: compte.id,
          destId: 'PENALITE',
          montantRc: BigInt(penalite),
          metadata: { sessionId, stationNum, groupesFraudeurs: otherGroups },
        },
      });
    }

    return { partageDetecte: true, groupesFraudeurs: otherGroups };
  }

  return { partageDetecte: false };
}

// Get all QR codes for a session
export async function getSessionQRCodes(sessionId: string) {
  const qrCodes = await prisma.qRCode.findMany({
    where: { sessionId },
    orderBy: [{ stationNum: 'asc' }, { groupeId: 'asc' }],
  });

  return qrCodes.map((qr) => ({
    id: qr.id,
    groupeId: qr.groupeId,
    stationNum: qr.stationNum,
    lieuNom: qr.lieuNom,
    isUtilise: qr.isUtilise,
    utiliseAt: qr.utiliseAt,
    expiresAt: qr.expiresAt,
  }));
}

// Generate all QR codes for a session
export async function generateSessionQRCodes(
  sessionId: string,
  lieux: Array<{ stationNum: number; nom: string }>
): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      sessionGroupes: {
        select: { groupeId: true },
      },
    },
  });

  if (!session) {
    throw new Error('Session non trouvée');
  }

  // Generate QR codes for each group at each station
  for (const sg of session.sessionGroupes) {
    for (const lieu of lieux) {
      await generateStationQR(
        sessionId,
        sg.groupeId,
        lieu.stationNum,
        lieu.nom,
        120 // 2 hours validity
      );
    }
  }
}
