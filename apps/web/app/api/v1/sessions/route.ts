import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import prisma from '@/lib/prisma';
import { createSessionQuestions } from '@/lib/services/questionService';

// GET - List all sessions
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
    const status = searchParams.get('status');
    const groupeId = searchParams.get('groupeId');

    const where: Record<string, unknown> = {};
    
    if (status) {
      where.status = status;
    }
    
    if (groupeId) {
      where.groupeId = groupeId;
    }

    // If ELEVE, only show sessions they're part of
    if (user.role === 'ELEVE') {
      where.OR = [
        { participations: { some: { userId: user.id } } },
        { groupe: { membres: { some: { userId: user.id } } } },
      ];
    }

    const sessions = await prisma.session.findMany({
      where,
      include: {
        groupe: { select: { nom: true } },
        formateur: { select: { nom: true } },
        _count: {
          select: {
            participations: true,
            questions: true,
          },
        },
      },
      orderBy: { dateDebut: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST - Create a new session
export async function POST(request: NextRequest) {
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
        { success: false, error: 'Seuls les formateurs peuvent créer des sessions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      nom,
      thematique,
      niveau,
      groupeId,
      dateDebut,
      dateFin,
      lieu,
      description,
      nbQuestions,
    } = body;

    if (!nom || !thematique || !niveau || !groupeId || !dateDebut) {
      return NextResponse.json(
        { success: false, error: 'Paramètres manquants' },
        { status: 400 }
      );
    }

    const session = await prisma.session.create({
      data: {
        nom,
        thematique,
        niveau,
        groupeId,
        formateurId: user.id,
        dateDebut: new Date(dateDebut),
        dateFin: dateFin ? new Date(dateFin) : null,
        lieu,
        description,
        status: 'PLANIFIEE',
      },
    });

    // Generate QCM questions for this session
    await createSessionQuestions(
      session.id,
      thematique,
      niveau,
      nbQuestions || 10
    );

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('Error in POST /api/v1/sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
