import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import prisma from '@/lib/prisma';

// GET - Get cotisation status for a group
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ groupeId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const { groupeId } = await params;

    const cotisations = await prisma.cotisation.findMany({
      where: { groupeId },
      include: {
        user: { select: { id: true, nom: true, email: true } },
      },
      orderBy: { dateEcheance: 'desc' },
    });

    // Calculate stats
    const total = cotisations.length;
    const payees = cotisations.filter((c) => c.status === 'PAYEE').length;
    const enAttente = cotisations.filter((c) => c.status === 'EN_ATTENTE').length;
    const enRetard = cotisations.filter((c) => c.status === 'EN_RETARD').length;

    return NextResponse.json({
      success: true,
      data: {
        cotisations,
        stats: {
          total,
          payees,
          enAttente,
          enRetard,
          tauxPaiement: total > 0 ? ((payees / total) * 100).toFixed(1) : 0,
        },
      },
    });
  } catch (error) {
    console.error('Error in GET /api/v1/cotisation/[groupeId]:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
