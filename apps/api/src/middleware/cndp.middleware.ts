import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── logAccesDonneesPersonnelles ───────────────────────────────
// Crée une entrée dans audit_logs si un utilisateur consulte
// le profil d'un autre utilisateur (conformité Loi 09-08 CNDP)
export function logAccesDonneesPersonnelles(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const cibleId = req.params.userId || req.params.id;
  const acteurId = req.user?.id;

  // Seulement si l'acteur consulte un profil différent du sien
  if (acteurId && cibleId && acteurId !== cibleId) {
    // Log asynchrone — ne pas bloquer la requête
    prisma.auditLog.create({
      data: {
        acteurId,
        action: `${req.method}_${req.path}`,
        cibleType: 'user',
        cibleId,
        ip: (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
      },
    }).catch((err) => {
      console.error('[CNDP] Échec audit log:', err.message);
    });
  }

  next();
}

// ── logExportDonnees ──────────────────────────────────────────
// Log spécifique pour les exports de données (PDF, CSV)
export function logExportDonnees(entityType: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.user?.id) {
      const cibleId = req.params.userId || req.params.id || req.user.id;
      prisma.auditLog.create({
        data: {
          acteurId: req.user.id,
          action: `EXPORT_${entityType.toUpperCase()}`,
          cibleType: entityType,
          cibleId,
          ip: (req.headers['x-forwarded-for'] as string) || req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
        },
      }).catch(console.error);
    }
    next();
  };
}
