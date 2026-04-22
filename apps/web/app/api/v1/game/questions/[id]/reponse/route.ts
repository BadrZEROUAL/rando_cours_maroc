import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { submitAnswer } from '@/lib/services/questionService';

export async function POST(
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

    const { id: questionId } = await params;
    const body = await request.json();
    const { reponseIndex } = body;

    if (typeof reponseIndex !== 'number' || reponseIndex < 0 || reponseIndex > 3) {
      return NextResponse.json(
        { success: false, error: 'Index de réponse invalide' },
        { status: 400 }
      );
    }

    const result = await submitAnswer(questionId, user.id, reponseIndex);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in POST /api/v1/game/questions/[id]/reponse:', error);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
