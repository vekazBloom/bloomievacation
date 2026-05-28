import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAuthedProfile, listBoardSprintsWithSync } from '@/lib/jira/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  try {
    const boardIdParam = Number(request.nextUrl.searchParams.get('boardId'));
    const requestedBoardId = Number.isInteger(boardIdParam) && boardIdParam > 0 ? boardIdParam : null;
    const sprints = await listBoardSprintsWithSync({
      profile: { id: auth.user.id, is_system_admin: auth.profile.is_system_admin },
      requestedBoardId,
    });
    return NextResponse.json({ sprints });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sprints' },
      { status: 500 }
    );
  }
}
