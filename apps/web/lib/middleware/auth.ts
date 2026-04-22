import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  isMineur: boolean;
  groupeId?: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    // Get profile data
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role, is_mineur, groupe_id')
      .eq('id', user.id)
      .single();

    return {
      id: user.id,
      email: user.email!,
      role: profile?.role ?? 'eleve',
      isMineur: profile?.is_mineur ?? false,
      groupeId: profile?.groupe_id ?? undefined,
    };
  } catch {
    return null;
  }
}

export function unauthorizedResponse(message = 'Non authentifié') {
  return NextResponse.json(
    { success: false, error: message, code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}

export function forbiddenResponse(message = 'Accès refusé', requiredRoles?: string[]) {
  return NextResponse.json(
    { 
      success: false, 
      error: message, 
      code: 'FORBIDDEN',
      ...(requiredRoles && { requiredRoles })
    },
    { status: 403 }
  );
}

export function requireRoles(user: AuthUser | null, ...roles: string[]): NextResponse | null {
  if (!user) {
    return unauthorizedResponse('Token manquant ou invalide');
  }

  if (!roles.includes(user.role)) {
    return forbiddenResponse(`Rôles autorisés : ${roles.join(', ')}`, roles);
  }

  return null;
}
