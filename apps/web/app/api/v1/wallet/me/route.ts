import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getWalletInfo } from '@/lib/services/walletService';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const walletInfo = await getWalletInfo(user.id);

    return NextResponse.json({
      success: true,
      data: walletInfo,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/wallet/me:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
