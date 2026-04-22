// tests/integration/session.test.ts
// Agent A4 — Tests d'intégration flux complet Escape Game
import { jest } from '@jest/globals';

// ── Mocks globaux ─────────────────────────────────────────────
jest.mock('@prisma/client', () => {
  const mockQuestion = {
    id: 'q-001',
    bonneReponse: 4,
    explication: 'Explication complète de la bonne réponse',
    stationNum: 1,
    sessionId: 'session-test',
    session: { difficulte: 3 },
  };

  const mockSessionGroupe = {
    sessionId: 'session-test',
    groupeId: 'groupe-test',
    scoreQcm: 0,
    randoCoins: 100,
  };

  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      question: {
        findUnique: jest.fn().mockResolvedValue(mockQuestion as any),
        findMany: jest.fn().mockResolvedValue([mockQuestion] as any),
      },
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-test',
          messageSecret: 'PENSER',
          difficulte: 3,
          niveau: 'BAC2_SMA',
          matiere: 'Maths',
          theme: 'IA',
          nbHallucinations: 1,
        } as any),
      },
      sessionGroupe: {
        findUnique: jest.fn().mockResolvedValue(mockSessionGroupe as any),
        update: jest.fn().mockResolvedValue(mockSessionGroupe as any),
      },
      reponseGroupe: {
        create: jest.fn().mockResolvedValue({ id: 'rep-001' } as any),
        findFirst: jest.fn().mockResolvedValue(null as any),
        findMany: jest.fn().mockResolvedValue([] as any),
      },
      qRCode: {
        findFirst: jest.fn().mockResolvedValue({ id: 'qr-001', isUtilise: false } as any),
        update: jest.fn().mockResolvedValue({ id: 'qr-001', isUtilise: true } as any),
        create: jest.fn().mockResolvedValue({ id: 'qr-new' } as any),
      },
      transaction: {
        create: jest.fn().mockResolvedValue({ id: 'tx-001' } as any),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-001' } as any),
      },
      $transaction: jest.fn().mockImplementation(async (ops: any) => {
        if (Array.isArray(ops)) return Promise.all(ops);
        return ops({
          reponseGroupe: { create: jest.fn().mockResolvedValue({ id: 'r1' }) },
          sessionGroupe: { update: jest.fn().mockResolvedValue({}) },
        });
      }),
    })),
    TransactionType: {
      PENALITE_PARTAGE: 'PENALITE_PARTAGE',
      CREDIT_DH: 'CREDIT_DH',
    },
  };
});

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  get: jest.fn().mockResolvedValue(null as any),
  setex: jest.fn().mockResolvedValue('OK' as any),
})));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn().mockReturnValue({
    sessionId: 'session-test',
    groupeId: 'groupe-test',
    stationNum: 1,
    lieuNom: 'Bibliothèque',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 1800,
  }),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,MOCK' as any),
}));

import request from 'supertest';
import app from '../../apps/api/src/app';

// ── Helper : simuler un token auth ───────────────────────────
const AUTH_TOKEN = 'Bearer mock-auth-token';

// Bypass auth middleware pour les tests
jest.mock('../../apps/api/src/middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-test', email: 'test@test.ma', role: 'eleve', isMineur: false, groupeId: 'groupe-test' };
    next();
  },
  requireRole: (..._roles: string[]) => (_req: any, _res: any, next: any) => next(),
  requireConsentement: (_req: any, _res: any, next: any) => next(),
}));

// ── SUITE 1 : Réponse à une question ─────────────────────────
describe('POST /api/v1/questions/:id/reponse', () => {
  test('TEST 1 : Bonne réponse (choix=4) → correct=true, points=15, rc=+20', async () => {
    const timestampDebut = Date.now() - 25_000; // 25s écoulées — délai respecté

    const res = await request(app)
      .post('/api/v1/questions/q-001/reponse')
      .set('Authorization', AUTH_TOKEN)
      .send({ choix: 4, essai: 1, groupeId: 'groupe-test', timestampDebut });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.correct).toBe(true);
    expect(res.body.data.points).toBe(15); // 5 × difficulte 3
    expect(res.body.data.rcVariation).toBe(20);
  });

  test('TEST 2 : Mauvaise réponse → correct=false, points=0, rc=-5', async () => {
    const timestampDebut = Date.now() - 25_000;

    const res = await request(app)
      .post('/api/v1/questions/q-001/reponse')
      .set('Authorization', AUTH_TOKEN)
      .send({ choix: 7, essai: 1, groupeId: 'groupe-test', timestampDebut });

    expect(res.status).toBe(200);
    expect(res.body.data.correct).toBe(false);
    expect(res.body.data.points).toBe(0);
    expect(res.body.data.rcVariation).toBe(-5);
  });

  test('TEST 3 : Délai < 20s → rejeté avec 429', async () => {
    const timestampDebut = Date.now() - 5_000; // Seulement 5s

    const res = await request(app)
      .post('/api/v1/questions/q-001/reponse')
      .set('Authorization', AUTH_TOKEN)
      .send({ choix: 4, essai: 1, groupeId: 'groupe-test', timestampDebut });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('DELAI_NON_RESPECTE');
  });
});

// ── SUITE 2 : Scan QR ─────────────────────────────────────────
describe('POST /api/v1/qrcode/scan', () => {
  test('TEST 4 : Scan valide → retourne les questions de la station', async () => {
    const res = await request(app)
      .post('/api/v1/qrcode/scan')
      .set('Authorization', AUTH_TOKEN)
      .send({ token: 'valid-token', groupeId: 'groupe-test' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.questions).toBeDefined();
    expect(Array.isArray(res.body.data.questions)).toBe(true);
  });
});

// ── SUITE 3 : Pool commun ─────────────────────────────────────
describe('Distribution du pool commun', () => {
  test('TEST 5 : calculerPool prélève exactement 20% de commission', async () => {
    const { calculerPool } = await import('../../apps/api/src/services/walletService');

    // Mock findMany pour simuler 3 groupes
    const { PrismaClient } = await import('@prisma/client');
    const prismaInstance = new (PrismaClient as any)();
    prismaInstance.sessionGroupe.findMany.mockResolvedValue([
      { groupe: { compteCollectif: { soldeRc: BigInt(1000) } } },
      { groupe: { compteCollectif: { soldeRc: BigInt(2000) } } },
      { groupe: { compteCollectif: { soldeRc: BigInt(3000) } } },
    ] as any);

    const result = await calculerPool('session-test');

    expect(result.totalRc).toBe(6000);
    expect(result.commission).toBe(1200);        // 20% de 6000
    expect(result.poolDistribuable).toBe(4800);  // 80% de 6000
  });
});
