import { NextRequest } from 'next/server';
import { readErrorResponse, readOkResponse } from '@/lib/api/read-response';
import { listMyLeaveRequests } from '@/lib/read/leave-requests';
import { getCurrentUser } from '@/lib/projects/access';
import type { LeaveStatus, LeaveType } from '@/types/database';

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return readErrorResponse({ ok: false, error: 'Not authenticated', status: 401 });

  const params = request.nextUrl.searchParams;
  const limit = params.get('limit') ? Number(params.get('limit')) : undefined;
  const status = params.get('status') as LeaveStatus | null;
  const type = params.get('type') as LeaveType | null;
  const fromDate = params.get('fromDate');

  const result = await listMyLeaveRequests(supabase, user.id, {
    limit,
    status: status ?? undefined,
    type: type ?? undefined,
    fromDate: fromDate ?? undefined,
  });

  if (!result.ok) return readErrorResponse(result);
  return readOkResponse({ requests: result.requests });
}
