import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { creditWallet } from '@/lib/services/walletService';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Only FORMATEUR can credit wallets
    if (user.role !== 'FORMATEUR') {
      return NextResponse.json(
        { success: false, error: 'Action non autorisée' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, montant, description } = body;

    if (!userId || !montant || montant <= 0) {
      return NextResponse.json(
        { success: false, error: 'Paramètres invalides' },
        { status: 400 }
      );
    }

    const result = await creditWallet(userId, montant, description || 'Crédit par formateur');

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in POST /api/v1/wallet/credit:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
