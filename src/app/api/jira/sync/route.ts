import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthedProfile, syncSprintMetrics } from '@/lib/jira/service';

const payloadSchema = z.object({
  sprintId: z.number().int().positive(),
  boardId: z.number().int().positive().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (!auth.profile.is_system_admin) {
    return NextResponse.json({ error: 'Only admins can run Jira sync' }, { status: 403 });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    const snapshot = await syncSprintMetrics({
      sprintId: parsed.data.sprintId,
      syncedBy: auth.user.id,
      profile: { id: auth.user.id, is_system_admin: auth.profile.is_system_admin },
      requestedBoardId: parsed.data.boardId ?? null,
    });
    return NextResponse.json({ snapshot });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
