import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { generateSessionBadge } from '@/lib/services/certificateService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const { sessionId } = await params;

    const result = await generateSessionBadge(sessionId, user.id);

    if (!result.eligible) {
      return NextResponse.json(
        { success: false, error: 'Vous n\'êtes pas éligible pour un badge sur cette session' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        badgeType: result.badgeType,
        ...result.badge,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/v1/badges/generer/[sessionId]:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
