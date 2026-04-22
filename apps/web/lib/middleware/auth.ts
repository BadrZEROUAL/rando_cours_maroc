import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  isMineur: boolean;
  groupeId?: string;
}

export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Get user profile from database
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: { 
        role: true, 
        isMineur: true, 
        groupeId: true 
      },
    });

    return {
      id: user.id,
      email: user.email!,
      role: profile?.role ?? 'ELEVE',
      isMineur: profile?.isMineur ?? false,
      groupeId: profile?.groupeId ?? undefined,
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
