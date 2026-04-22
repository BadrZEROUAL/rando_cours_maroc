import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { genererJumeauNumerique } from '@/lib/services/coachIAService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupeId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const { groupeId } = await params;

    const jumeauNumerique = await genererJumeauNumerique(groupeId);

    return NextResponse.json({
      success: true,
      data: jumeauNumerique,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/coach/jumeau/[groupeId]:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
