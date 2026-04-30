import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getCoachingHistory } from '@/lib/services/coachIAService';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const history = await getCoachingHistory(user.id);

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/coach/me:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
