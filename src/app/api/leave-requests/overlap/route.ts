import { NextRequest } from 'next/server';
import { readErrorResponse, readOkResponse } from '@/lib/api/read-response';
import { getVacationOverlap } from '@/lib/read/team-leave';
import { getCurrentUser } from '@/lib/projects/access';

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return readErrorResponse({ ok: false, error: 'Not authenticated', status: 401 });

  const params = request.nextUrl.searchParams;
  const projectId = params.get('projectId');
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');

  if (!projectId || !startDate || !endDate) {
    return readErrorResponse({
      ok: false,
      error: 'projectId, startDate i endDate su obavezni.',
      status: 400,
    });
  }

  const result = await getVacationOverlap(supabase, user.id, projectId, startDate, endDate);
  if (!result.ok) return readErrorResponse(result);
  return readOkResponse({
    totalMembers: result.totalMembers,
    overlappingMembers: result.overlappingMembers,
    thresholdPercent: result.thresholdPercent,
    overlapPercent: result.overlapPercent,
    exceedsThreshold: result.exceedsThreshold,
  });
}
