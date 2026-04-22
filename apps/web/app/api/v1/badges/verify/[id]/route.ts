import { NextRequest, NextResponse } from 'next/server';
import { verifyBadge } from '@/lib/services/certificateService';

// Public route - no auth required for verification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await verifyBadge(id);

    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: result.message },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.badge,
    });
  } catch (error) {
    console.error('Error in GET /api/v1/badges/verify/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
