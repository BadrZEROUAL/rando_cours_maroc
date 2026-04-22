import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { scanQRCode } from '@/lib/services/qrCodeService';

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
    const { token, groupeId } = body;

    if (!token || !groupeId) {
      return NextResponse.json(
        { success: false, error: 'Token et groupeId requis' },
        { status: 400 }
      );
    }

    const result = await scanQRCode(token, user.id, groupeId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in POST /api/v1/game/qrcode/scan:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
