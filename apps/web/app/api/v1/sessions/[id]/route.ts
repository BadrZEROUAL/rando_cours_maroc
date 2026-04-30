import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import prisma from '@/lib/prisma';

// GET - Get session details
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

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        groupe: {
          include: {
            membres: {
              include: {
                user: { select: { id: true, nom: true, email: true } },
              },
            },
          },
        },
        formateur: { select: { id: true, nom: true, email: true } },
        questions: {
          select: {
            id: true,
            question: true,
            options: true,
            difficulte: true,
            ordre: true,
          },
          orderBy: { ordre: 'asc' },
        },
        participations: {
          include: {
            user: { select: { id: true, nom: true } },
            reponses: true,
          },
        },
        checkpoints: true,
        fragments: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session non trouvée' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/sessions/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// PATCH - Update session
export async function PATCH(
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

    if (user.role !== 'FORMATEUR') {
      return NextResponse.json(
        { success: false, error: 'Action non autorisée' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const session = await prisma.session.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error in PATCH /api/v1/sessions/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
