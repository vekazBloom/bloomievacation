import { readErrorResponse, readOkResponse } from '@/lib/api/read-response';
import { getMyLeaveBalance } from '@/lib/read/leave-balance';
import { getCurrentUser } from '@/lib/projects/access';

export async function GET() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return readErrorResponse({ ok: false, error: 'Not authenticated', status: 401 });

  const result = await getMyLeaveBalance(supabase, user.id);
  if (!result.ok) return readErrorResponse(result);
  return readOkResponse({ balance: result.balance });
}
