import { validateLeaveBalance } from '@/lib/leave/balance';
import type { LeaveType } from '@/types/database';
import type { AppSupabase } from '@/lib/supabase/app-client';

type DbClient = AppSupabase;

export async function assertLeaveBalance(
  supabase: DbClient,
  params: {
    userId: string;
    projectId: string;
    type: LeaveType;
    workingDays: number;
    excludeRequestId?: string;
  }
) {
  const { data: membership, error: membershipError } = await supabase
    .from('project_members')
    .select(
      'annual_leave_total, annual_leave_used, annual_leave_carried_over, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used'
    )
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (membershipError) {
    return { ok: false as const, status: 500, error: membershipError.message };
  }
  if (!membership) {
    return { ok: false as const, status: 404, error: 'Project membership not found' };
  }

  let pendingQuery = supabase
    .from('leave_requests')
    .select('id, type, working_days_count')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .eq('status', 'pending');

  if (params.excludeRequestId) {
    pendingQuery = pendingQuery.neq('id', params.excludeRequestId);
  }

  const { data: pendingRequests, error: pendingError } = await pendingQuery;
  if (pendingError) {
    return { ok: false as const, status: 500, error: pendingError.message };
  }

  const validation = validateLeaveBalance({
    membership,
    type: params.type,
    workingDays: params.workingDays,
    pendingRequests: pendingRequests || [],
    excludeRequestId: params.excludeRequestId,
  });

  if (!validation.ok) {
    return {
      ok: false as const,
      status: 400,
      error: `Insufficient ${params.type} leave balance. ${validation.remaining} day(s) remaining.`,
    };
  }

  return { ok: true as const, membership };
}
