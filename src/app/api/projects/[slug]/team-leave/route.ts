import { NextRequest } from 'next/server';
import { readErrorResponse, readOkResponse } from '@/lib/api/read-response';
import {
  getTeamLeaveInRange,
  getTeamLeaveThisWeek,
  getTeamLeaveToday,
} from '@/lib/read/team-leave';
import { getCurrentUser } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';
import type { LeaveType } from '@/types/database';

type RouteContext = { params: { slug: string } };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return readErrorResponse({ ok: false, error: 'Not authenticated', status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return readErrorResponse({ ok: false, error: 'Projekat nije pronađen.', status: 404 });

  const searchParams = request.nextUrl.searchParams;
  const scope = searchParams.get('scope');
  const includePending = searchParams.get('includePending') === 'true';
  const typesParam = searchParams.get('types');
  const types = typesParam
    ? (typesParam.split(',').filter(Boolean) as LeaveType[])
    : undefined;

  let result;
  if (scope === 'today') {
    result = await getTeamLeaveToday(supabase, user.id, project.id, { includePending });
  } else if (scope === 'week') {
    result = await getTeamLeaveThisWeek(supabase, user.id, project.id, { includePending });
  } else {
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (!startDate || !endDate) {
      return readErrorResponse({
        ok: false,
        error: 'startDate i endDate su obavezni (ili koristite scope=today|week).',
        status: 400,
      });
    }
    result = await getTeamLeaveInRange(supabase, user.id, project.id, startDate, endDate, {
      includePending,
      types,
    });
  }

  if (!result.ok) return readErrorResponse(result);
  return readOkResponse({ entries: result.entries });
}
