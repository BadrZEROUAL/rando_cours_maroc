import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

// ── Supabase admin client (service role) ──────────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Extend Express Request ─────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
        isMineur: boolean;
        groupeId?: string;
      };
    }
  }
}

// ── authMiddleware ────────────────────────────────────────────
// Vérifie le JWT Supabase dans l'en-tête Authorization
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Token manquant. Ajoutez Authorization: Bearer <token>',
      code: 'MISSING_TOKEN',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    // Vérification du JWT via Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({
        success: false,
        error: 'Token invalide ou expiré',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    // Récupérer les métadonnées du profil (role, isMineur, groupeId)
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role, is_mineur, groupe_id')
      .eq('id', user.id)
      .single();

    req.user = {
      id: user.id,
      email: user.email!,
      role: profile?.role ?? 'eleve',
      isMineur: profile?.is_mineur ?? false,
      groupeId: profile?.groupe_id ?? undefined,
    };

    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: 'Erreur d\'authentification',
      code: 'AUTH_ERROR',
    });
  }
}

// ── requireRole ───────────────────────────────────────────────
// Middleware de garde par rôle — utiliser après authMiddleware
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Accès refusé. Rôles autorisés : ${roles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE',
        required: roles,
        current: req.user.role,
      });
      return;
    }

    next();
  };
}

// ── requireConsentement ───────────────────────────────────────
// Bloque l'accès aux fonctionnalités RC si mineur sans consentement
export function requireConsentement(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.user?.isMineur && !req.body?.consentementParent) {
    res.status(403).json({
      success: false,
      error: 'Consentement parental requis pour accéder aux fonctionnalités RandoCoins',
      code: 'CONSENTEMENT_REQUIRED',
    });
    return;
  }
  next();
}
