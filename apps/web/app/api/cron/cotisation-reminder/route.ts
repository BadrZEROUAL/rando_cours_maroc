import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find cotisations that are due soon and not paid
    const cotisationsToRemind = await prisma.cotisation.findMany({
      where: {
        isPaid: false,
        dueAt: { lte: in7Days },
      },
      include: {
        groupe: { select: { nom: true } },
      },
    });

    // Update overdue cotisations - block collective accounts
    const overdueCotisations = cotisationsToRemind.filter(
      (c) => c.dueAt < now && !c.bloqueAt
    );

    let blockedCount = 0;
    for (const cotisation of overdueCotisations) {
      // Mark as blocked
      await prisma.cotisation.update({
        where: { id: cotisation.id },
        data: { bloqueAt: now },
      });

      // Block the group's collective account
      await prisma.compteCollectif.updateMany({
        where: { groupeId: cotisation.groupeId },
        data: { bloque: true },
      });

      blockedCount++;
    }

    // Update reminder flags for J-7 and J-1
    const in1Day = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Send J-7 reminders
    await prisma.cotisation.updateMany({
      where: {
        isPaid: false,
        rappelJ7: false,
        dueAt: { lte: in7Days, gt: in1Day },
      },
      data: { rappelJ7: true },
    });

    // Send J-1 reminders
    await prisma.cotisation.updateMany({
      where: {
        isPaid: false,
        rappelJ1: false,
        dueAt: { lte: in1Day, gt: now },
      },
      data: { rappelJ1: true },
    });

    // Log the job execution
    console.log(`[CRON] Cotisation reminder: ${cotisationsToRemind.length} cotisations checked, ${blockedCount} accounts blocked`);

    return NextResponse.json({
      success: true,
      data: {
        cotisationsChecked: cotisationsToRemind.length,
        accountsBlocked: blockedCount,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    console.error('[CRON] Error in cotisation-reminder:', error);
    return NextResponse.json(
      { success: false, error: 'Cron job failed' },
      { status: 500 }
    );
  }
}

// Vercel Cron requires a specific config
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max
