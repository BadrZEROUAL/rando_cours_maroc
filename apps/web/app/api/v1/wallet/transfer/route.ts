import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { transferPoints } from '@/lib/services/walletService';

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
    const { toUserId, montant, description } = body;

    if (!toUserId || !montant || montant <= 0) {
      return NextResponse.json(
        { success: false, error: 'Paramètres invalides' },
        { status: 400 }
      );
    }

    if (toUserId === user.id) {
      return NextResponse.json(
        { success: false, error: 'Vous ne pouvez pas vous transférer des points' },
        { status: 400 }
      );
    }

    const result = await transferPoints(
      user.id,
      toUserId,
      montant,
      description || 'Transfert de points'
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in POST /api/v1/wallet/transfer:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
