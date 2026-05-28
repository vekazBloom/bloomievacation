import { NextRequest, NextResponse } from 'next/server';
import { getAuthedProfile, getUserSprintMetrics } from '@/lib/jira/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await getAuthedProfile();
  if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const sprintIdParam = request.nextUrl.searchParams.get('sprintId');
  const boardIdParam = request.nextUrl.searchParams.get('boardId');
  const sprintId = Number(sprintIdParam);
  const boardId = Number(boardIdParam);
  if (!Number.isFinite(sprintId) || sprintId <= 0) {
    return NextResponse.json({ error: 'sprintId is required' }, { status: 400 });
  }

  const data = await getUserSprintMetrics(sprintId, {
    id: auth.user.id,
    is_system_admin: auth.profile.is_system_admin,
  }, Number.isInteger(boardId) && boardId > 0 ? boardId : null);
  return NextResponse.json(data);
}
