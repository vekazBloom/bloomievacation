import { validateLeaveBalance } from '@/lib/leave/balance';
import { getUserLeaveBalance } from '@/lib/leave/global-balance';
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
  const { data: globalBalance, error: globalBalanceError } = await getUserLeaveBalance(
    supabase,
    params.userId
  );

  const tableMissing = Boolean(
    globalBalanceError &&
      (globalBalanceError.message.includes('user_leave_balances') ||
        globalBalanceError.message.includes('does not exist'))
  );

  /** When global table exists but this user has no row yet, fall back to project_members for this project. */
  const globalRowMissing = !tableMissing && !globalBalance && !globalBalanceError;

  /** Approvers often cannot SELECT another user's global row (RLS); membership in this project is still readable. */
  const globalReadFailed = !tableMissing && Boolean(globalBalanceError);

  const useProjectScopedFallback = tableMissing || globalRowMissing || globalReadFailed;

  const { data: membership, error: membershipError } = useProjectScopedFallback
    ? await supabase
        .from('project_members')
        .select(
          'annual_leave_total, annual_leave_used, annual_leave_carried_over, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used'
        )
        .eq('project_id', params.projectId)
        .eq('user_id', params.userId)
        .maybeSingle()
    : { data: null, error: null };

  if (useProjectScopedFallback && membershipError) {
    return { ok: false as const, status: 500, error: membershipError.message };
  }

  const balanceSource = globalBalance || membership;
  if (!balanceSource) {
    return {
      ok: false as const,
      status: 404,
      error: useProjectScopedFallback ? 'Project membership not found' : 'User leave balance not found',
    };
  }

  let pendingQuery = supabase
    .from('leave_requests')
    .select('id, type, working_days_count')
    .eq('user_id', params.userId)
    .eq('status', 'pending');

  if (useProjectScopedFallback) {
    pendingQuery = pendingQuery.eq('project_id', params.projectId);
  }

  if (params.excludeRequestId) {
    pendingQuery = pendingQuery.neq('id', params.excludeRequestId);
  }

  const { data: pendingRequests, error: pendingError } = await pendingQuery;
  if (pendingError) {
    return { ok: false as const, status: 500, error: pendingError.message };
  }

  const validation = validateLeaveBalance({
    membership: balanceSource,
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

  return { ok: true as const, membership: balanceSource };
}
