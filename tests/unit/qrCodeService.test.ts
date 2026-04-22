import { jest } from '@jest/globals';

jest.mock('jsonwebtoken');
jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(), setex: jest.fn(),
  })),
}));
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    qRCode: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  })),
}));

import jwt from 'jsonwebtoken';
import { validateQRScan, genererParcoursGroupes } from '../../apps/api/src/services/qrCodeService';
import { PrismaClient } from '@prisma/client';

const mockPrisma = new (PrismaClient as any)();

beforeEach(() => jest.clearAllMocks());

describe('validateQRScan', () => {
  test('TEST 1 : token expiré → QR_EXPIRED', async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      const err: any = new Error('jwt expired');
      err.name = 'TokenExpiredError';
      throw err;
    });
    const result = await validateQRScan('expired.token', 'groupe-123');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('QR_EXPIRED');
  });

  test('TEST 2 : mauvais groupe → QR_WRONG_GROUPE', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      sessionId: 's1', groupeId: 'groupe-OWNER', stationNum: 1, lieuNom: 'Labo',
      iat: 0, exp: Date.now() + 1800,
    });
    const result = await validateQRScan('valid.token', 'groupe-IMPOSTEUR');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('QR_WRONG_GROUPE');
  });

  test('TEST 3 : scan valide → payload retourné + QR marqué utilisé', async () => {
    const payload = {
      sessionId: 's1', groupeId: 'g1', stationNum: 1, lieuNom: 'Labo',
      iat: 0, exp: Date.now() + 1800,
    };
    (jwt.verify as jest.Mock).mockReturnValue(payload);
    mockPrisma.qRCode.findUnique.mockResolvedValue({ id: 'qr1', isUtilise: false });
    mockPrisma.qRCode.update.mockResolvedValue({ id: 'qr1', isUtilise: true });

    const result = await validateQRScan('valid.token', 'g1');
    expect(result.valid).toBe(true);
    expect(result.payload?.groupeId).toBe('g1');
    expect(mockPrisma.qRCode.update).toHaveBeenCalledWith({
      where: { token: 'valid.token' },
      data: expect.objectContaining({ isUtilise: true }),
    });
  });

  test('TEST 4 : double scan → QR_ALREADY_USED', async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      sessionId: 's1', groupeId: 'g1', stationNum: 1, lieuNom: 'Labo',
      iat: 0, exp: Date.now() + 1800,
    });
    mockPrisma.qRCode.findUnique.mockResolvedValue({ id: 'qr1', isUtilise: true });

    const result = await validateQRScan('valid.token', 'g1');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('QR_ALREADY_USED');
    expect(mockPrisma.qRCode.update).not.toHaveBeenCalled();
  });
});

describe('genererParcoursGroupes', () => {
  test('TEST 5 : 5 lieux, 3 groupes → 3 ordres distincts', () => {
    const lieux = ['Biblio', 'Labo', 'Info', 'Cour', 'Arts'];
    const parcours = genererParcoursGroupes(lieux, 3);
    const ordres = Object.values(parcours);

    expect(ordres).toHaveLength(3);
    ordres.forEach(o => expect(o).toHaveLength(5));

    const keys = ordres.map(o => o.join('|'));
    expect(new Set(keys).size).toBe(3);
  });

  test('TEST 6 : tous les lieux présents dans chaque ordre', () => {
    const lieux = ['A', 'B', 'C', 'D', 'E'];
    const parcours = genererParcoursGroupes(lieux, 2);
    Object.values(parcours).forEach(ordre =>
      expect([...ordre].sort()).toEqual([...lieux].sort())
    );
  });
});
