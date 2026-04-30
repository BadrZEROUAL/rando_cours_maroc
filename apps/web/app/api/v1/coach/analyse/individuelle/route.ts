import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { analyserEleve } from '@/lib/services/coachIAService';

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
    const userId = searchParams.get('userId') || user.id;

    // Only formateur can view other users' analysis
    if (userId !== user.id && user.role !== 'FORMATEUR') {
      return NextResponse.json(
        { success: false, error: 'Action non autorisée' },
        { status: 403 }
      );
    }

    const analysis = await analyserEleve(userId);

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/coach/analyse/individuelle:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
