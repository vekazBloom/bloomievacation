import { readErrorResponse, readOkResponse } from '@/lib/api/read-response';
import { getPersonalCalendarData } from '@/lib/read/calendar';
import { getCurrentUser } from '@/lib/projects/access';

export async function GET() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return readErrorResponse({ ok: false, error: 'Not authenticated', status: 401 });

  const result = await getPersonalCalendarData(supabase, user.id);
  return readOkResponse({ leaveRequests: result.leaveRequests, holidays: result.holidays });
}
