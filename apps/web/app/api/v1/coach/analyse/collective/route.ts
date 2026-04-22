import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { analyserGroupe } from '@/lib/services/coachIAService';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const groupeId = searchParams.get('groupeId');

    if (!groupeId) {
      return NextResponse.json(
        { success: false, error: 'groupeId requis' },
        { status: 400 }
      );
    }

    const analysis = await analyserGroupe(groupeId);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/coach/analyse/collective:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
