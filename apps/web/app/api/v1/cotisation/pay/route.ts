import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { cotisationId, methode } = body;

    if (!cotisationId) {
      return NextResponse.json(
        { success: false, error: 'cotisationId requis' },
        { status: 400 }
      );
    }

    // Get cotisation
    const cotisation = await prisma.cotisation.findUnique({
      where: { id: cotisationId },
    });

    if (!cotisation) {
      return NextResponse.json(
        { success: false, error: 'Cotisation non trouvée' },
        { status: 404 }
      );
    }

    // Only the user or a formateur can pay
    if (cotisation.userId !== user.id && user.role !== 'FORMATEUR') {
      return NextResponse.json(
        { success: false, error: 'Action non autorisée' },
        { status: 403 }
      );
    }

    if (cotisation.status === 'PAYEE') {
      return NextResponse.json(
        { success: false, error: 'Cette cotisation est déjà payée' },
        { status: 400 }
      );
    }

    // Update cotisation status
    const updatedCotisation = await prisma.cotisation.update({
      where: { id: cotisationId },
      data: {
        status: 'PAYEE',
        datePaiement: new Date(),
        methodePaiement: methode || 'ESPECES',
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedCotisation,
    });
  } catch (error) {
    console.error('Error in POST /api/v1/cotisation/pay:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
