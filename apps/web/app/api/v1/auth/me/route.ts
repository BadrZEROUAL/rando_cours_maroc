import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        nom: true,
        role: true,
        dateInscription: true,
        portefeuille: {
          select: {
            solde: true,
          },
        },
        _count: {
          select: {
            badges: true,
            participations: true,
          },
        },
      },
    });

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...userData,
        solde: userData.portefeuille?.solde || 0,
        badgesCount: userData._count.badges,
        participationsCount: userData._count.participations,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/v1/auth/me:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
