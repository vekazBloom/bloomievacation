import { NextRequest, NextResponse } from 'next/server';
import { getAuthedProfile, getSprintComparisonData } from '@/lib/jira/service';

export const dynamic = 'force-dynamic';

function parseSprintIds(raw: string | null) {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
}

export async function GET(request: NextRequest) {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const sprintIds = parseSprintIds(request.nextUrl.searchParams.get('sprintIds'));
  const boardId = Number(request.nextUrl.searchParams.get('boardId'));
  if (sprintIds.length < 2) {
    return NextResponse.json({ error: 'Select at least two sprints' }, { status: 400 });
  }
  if (sprintIds.length > 8) {
    return NextResponse.json({ error: 'Maximum 8 sprints can be compared' }, { status: 400 });
  }

  const data = await getSprintComparisonData({
    sprintIds,
    profile: { id: auth.user.id, is_system_admin: auth.profile.is_system_admin },
    requestedBoardId: Number.isInteger(boardId) && boardId > 0 ? boardId : null,
  });

  return NextResponse.json(data);
}
