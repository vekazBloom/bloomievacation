import { NextResponse } from 'next/server';
import { getAuthedProfile, listBoardSprintsWithSync } from '@/lib/jira/service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const sprints = await listBoardSprintsWithSync({
      id: auth.user.id,
      is_system_admin: auth.profile.is_system_admin,
    });
    return NextResponse.json({ sprints });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sprints' },
      { status: 500 }
    );
  }
}
