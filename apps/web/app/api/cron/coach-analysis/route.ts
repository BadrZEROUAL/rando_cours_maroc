import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { analyserEleve, analyserGroupe } from '@/lib/services/coachIAService';

// Verify cron secret to ensure this is called by Vercel Cron
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  
  const token = authHeader.replace('Bearer ', '');
  return token === process.env.CRON_SECRET;
}

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron call
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find sessions that completed recently and need analysis
    const recentSessions = await prisma.session.findMany({
      where: {
        status: 'completed',
        completedAt: { gte: oneDayAgo },
      },
      include: {
        sessionGroupes: {
          include: {
            groupe: {
              include: {
                membres: {
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });

    let individualAnalyses = 0;
    let groupAnalyses = 0;

    for (const session of recentSessions) {
      for (const sessionGroupe of session.sessionGroupes) {
        // Analyze each group member
        for (const membre of sessionGroupe.groupe.membres) {
          // Check if analysis already exists for today
          const existingAnalysis = await prisma.coachIASession.findFirst({
            where: {
              userId: membre.userId,
              sessionId: session.id,
              createdAt: { gte: oneDayAgo },
            },
          });

          if (!existingAnalysis) {
            try {
              await analyserEleve(membre.userId, session.id);
              individualAnalyses++;
            } catch (error) {
              console.error(`[CRON] Error analyzing user ${membre.userId}:`, error);
            }
          }
        }

        // Analyze the group
        const existingGroupAnalysis = await prisma.coachIASession.findFirst({
          where: {
            groupeId: sessionGroupe.groupeId,
            sessionId: session.id,
            patternCommun: true, // Group analysis marker
            createdAt: { gte: oneDayAgo },
          },
        });

        if (!existingGroupAnalysis) {
          try {
            await analyserGroupe(sessionGroupe.groupeId, session.id);
            groupAnalyses++;
          } catch (error) {
            console.error(`[CRON] Error analyzing group ${sessionGroupe.groupeId}:`, error);
          }
        }
      }
    }

    // Log the job execution
    console.log(`[CRON] Coach analysis: ${individualAnalyses} individual, ${groupAnalyses} group analyses`);

    return NextResponse.json({
      success: true,
      data: {
        sessionsProcessed: recentSessions.length,
        individualAnalyses,
        groupAnalyses,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('[CRON] Error in coach-analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Cron job failed' },
      { status: 500 }
    );
  }
}

// Vercel Cron requires a specific config
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for AI analysis
