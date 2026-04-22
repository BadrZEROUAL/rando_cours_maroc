import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { Redis } from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { QRPayload, QRScanResult } from '@randocours/shared';

const prisma = new PrismaClient();
const redis  = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const QR_SECRET = process.env.QR_JWT_SECRET!;
const QR_EXPIRY = parseInt(process.env.QR_JWT_EXPIRY || '1800'); // 30 min

// ── generateQRCode ─────────────────────────────────────────────
export async function generateQRCode(params: {
  sessionId: string;
  groupeId: string;
  stationNum: number;
  lieuNom: string;
}): Promise<{ token: string; qrDataUrl: string; qrUrl: string }> {
  const { sessionId, groupeId, stationNum, lieuNom } = params;

  const payload: Omit<QRPayload, 'iat' | 'exp'> = {
    sessionId, groupeId, stationNum, lieuNom,
  };

  const token = jwt.sign(payload, QR_SECRET, { expiresIn: QR_EXPIRY });

  const appUrl  = process.env.APP_URL || 'http://localhost:3000';
  const qrUrl   = `${appUrl}/station/scan?token=${token}`;

  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#1A2B4A', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  });

  const decoded = jwt.decode(token) as QRPayload;
  await prisma.qRCode.create({
    data: {
      sessionId, groupeId, stationNum, lieuNom, token,
      isUtilise: false,
      expiresAt: new Date(decoded.exp * 1000),
    },
  });

  return { token, qrDataUrl, qrUrl };
}

// ── validateQRScan ─────────────────────────────────────────────
export async function validateQRScan(
  token: string,
  scannerGroupeId: string
): Promise<QRScanResult> {
  // 1. Vérifier la signature JWT
  let payload: QRPayload;
  try {
    payload = jwt.verify(token, QR_SECRET) as QRPayload;
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return { valid: false, error: 'QR_EXPIRED' };
    }
    return { valid: false, error: 'QR_INVALID' };
  }

  // 2. Vérifier que c'est le bon groupe
  if (payload.groupeId !== scannerGroupeId) {
    return { valid: false, error: 'QR_WRONG_GROUPE' };
  }

  // 3. Double-scan
  const qrRecord = await prisma.qRCode.findUnique({ where: { token } });
  if (!qrRecord) return { valid: false, error: 'QR_INVALID' };
  if (qrRecord.isUtilise) return { valid: false, error: 'QR_ALREADY_USED' };

  // 4. Marquer utilisé
  await prisma.qRCode.update({
    where: { token },
    data: { isUtilise: true, utiliseAt: new Date() },
  });

  return { valid: true, payload };
}

// ── genererParcoursGroupes ─────────────────────────────────────
// Algorithme Fisher-Yates — ordre unique garanti par groupe
export function genererParcoursGroupes(
  lieux: string[],
  nbGroupes: number
): Record<string, string[]> {
  const parcours: Record<string, string[]> = {};
  const ordresUtilises = new Set<string>();

  for (let i = 1; i <= nbGroupes; i++) {
    let ordre: string[];
    let key: string;
    let attempts = 0;

    do {
      ordre = [...lieux];
      for (let j = ordre.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [ordre[j], ordre[k]] = [ordre[k], ordre[j]];
      }
      key = ordre.join('|');
      attempts++;
      if (attempts > 100) break; // sécurité anti-boucle infinie
    } while (ordresUtilises.has(key));

    ordresUtilises.add(key);
    parcours[`groupe_${i}`] = ordre;
  }

  return parcours;
}

// ── detecterPartageCode ────────────────────────────────────────
export async function detecterPartageCode(
  sessionId: string,
  groupeId: string,
  stationNum: number,
  codeStation: string
): Promise<{ partageDetecte: boolean; groupeOriginal?: string }> {
  const redisKey = `partage:${sessionId}:s${stationNum}:${codeStation}`;
  const existing = await redis.get(redisKey).catch(() => null);

  if (existing && existing !== groupeId) {
    return { partageDetecte: true, groupeOriginal: existing };
  }

  await redis.setex(redisKey, 7200, groupeId).catch(console.error);
  return { partageDetecte: false };
}
