import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

// Log access to personal data (CNDP Law 09-08 compliance)
export async function logAccesDonneesPersonnelles(
  acteurId: string,
  cibleId: string,
  action: string,
  request: NextRequest
): Promise<void> {
  if (acteurId && cibleId && acteurId !== cibleId) {
    try {
      await prisma.auditLog.create({
        data: {
          acteurId,
          action,
          cibleType: 'user',
          cibleId,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      });
    } catch (err) {
      console.error('[CNDP] Échec audit log:', err);
    }
  }
}

// Log data exports (PDF, CSV, etc.)
export async function logExportDonnees(
  acteurId: string,
  entityType: string,
  cibleId: string,
  request: NextRequest
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        acteurId,
        action: `EXPORT_${entityType.toUpperCase()}`,
        cibleType: entityType,
        cibleId,
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });
  } catch (err) {
    console.error('[CNDP] Échec audit log export:', err);
  }
}
