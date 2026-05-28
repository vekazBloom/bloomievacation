import { NextResponse } from 'next/server';
import { getBoardSprints } from '@/lib/jira/client';
import { getAuthedProfile, getJiraConnection } from '@/lib/jira/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const config = await getJiraConnection();
  if (!config) {
    return NextResponse.json({ error: 'Jira connection not configured' }, { status: 400 });
  }

  try {
    const sprints = await getBoardSprints(config);
    const normalized = sprints
      .map((s) => ({
        id: s.id,
        name: s.name,
        state: s.state,
        startDate: s.startDate ?? null,
        endDate: s.endDate ?? null,
        completeDate: s.completeDate ?? null,
      }))
      .sort((a, b) => b.id - a.id);
    return NextResponse.json({ sprints: normalized });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sprints' },
      { status: 500 }
    );
  }
}
