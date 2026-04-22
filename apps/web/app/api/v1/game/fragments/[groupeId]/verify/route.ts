import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { verifyFragmentCollection } from '@/lib/services/qrCodeService';

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
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'sessionId requis' },
        { status: 400 }
      );
    }

    const result = await verifyFragmentCollection(groupeId, sessionId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/game/fragments/[groupeId]/verify:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
