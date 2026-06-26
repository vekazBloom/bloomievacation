import { readErrorResponse, readOkResponse } from '@/lib/api/read-response';
import { getProjectTeamCalendarData } from '@/lib/read/calendar';
import { getCurrentUser } from '@/lib/projects/access';
import { getProjectBySlug } from '@/lib/projects/resolve';

type RouteContext = { params: { slug: string } };

export async function GET(_request: Request, { params }: RouteContext) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return readErrorResponse({ ok: false, error: 'Not authenticated', status: 401 });

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) return readErrorResponse({ ok: false, error: 'Projekat nije pronađen.', status: 404 });

  const result = await getProjectTeamCalendarData(supabase, user.id, project.id);
  if (!result.ok) return readErrorResponse(result);
  return readOkResponse({ leaveRequests: result.leaveRequests, holidays: result.holidays });
}
