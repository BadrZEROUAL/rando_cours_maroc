import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import prisma from '@/lib/prisma';

export async function POST(
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

    // Get session
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        groupe: {
          include: {
            membres: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session non trouvée' },
        { status: 404 }
      );
    }

    // Only formateur can start a session
    if (user.role !== 'FORMATEUR' && session.formateurId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Seul le formateur peut démarrer la session' },
        { status: 403 }
      );
    }

    if (session.status !== 'PLANIFIEE') {
      return NextResponse.json(
        { success: false, error: 'La session ne peut pas être démarrée' },
        { status: 400 }
      );
    }

    // Update session status
    const updatedSession = await prisma.session.update({
      where: { id },
      data: {
        status: 'EN_COURS',
        dateDebut: new Date(),
      },
    });

    // Create participations for all group members
    const membres = session.groupe.membres;
    for (const membre of membres) {
      const existingParticipation = await prisma.participation.findFirst({
        where: {
          sessionId: id,
          userId: membre.userId,
        },
      });

      if (!existingParticipation) {
        await prisma.participation.create({
          data: {
            sessionId: id,
            userId: membre.userId,
            score: 0,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedSession,
    });
  } catch (error) {
    console.error('Error in POST /api/v1/sessions/[id]/start:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
