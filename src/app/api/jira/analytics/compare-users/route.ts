import { NextRequest, NextResponse } from 'next/server';
import { getAuthedProfile, getUserComparisonData } from '@/lib/jira/service';

export const dynamic = 'force-dynamic';

function parseNumberList(raw: string | null) {
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

function parseStringList(raw: string | null) {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export async function GET(request: NextRequest) {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const sprintIds = parseNumberList(request.nextUrl.searchParams.get('sprintIds'));
  const requestedUserIds = parseStringList(request.nextUrl.searchParams.get('userIds'));
  const boardId = Number(request.nextUrl.searchParams.get('boardId'));

  if (sprintIds.length < 1) {
    return NextResponse.json({ error: 'Select at least one sprint' }, { status: 400 });
  }
  if (sprintIds.length > 8) {
    return NextResponse.json({ error: 'Maximum 8 sprints can be compared' }, { status: 400 });
  }
  if (requestedUserIds.length > 20) {
    return NextResponse.json({ error: 'Maximum 20 users can be compared' }, { status: 400 });
  }

  const data = await getUserComparisonData({
    sprintIds,
    requestedUserIds,
    profile: { id: auth.user.id, is_system_admin: auth.profile.is_system_admin },
    requestedBoardId: Number.isInteger(boardId) && boardId > 0 ? boardId : null,
  });

  return NextResponse.json(data);
}
