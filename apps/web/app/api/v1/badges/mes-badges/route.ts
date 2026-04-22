import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUserBadges } from '@/lib/services/certificateService';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const badges = await getUserBadges(user.id);

    return NextResponse.json({
      success: true,
      data: badges,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/badges/mes-badges:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
