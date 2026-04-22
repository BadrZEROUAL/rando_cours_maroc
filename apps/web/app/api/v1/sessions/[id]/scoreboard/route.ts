import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getLeaderboard } from '@/lib/services/scoringService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const leaderboard = await getLeaderboard(id);

    return NextResponse.json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/sessions/[id]/scoreboard:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
