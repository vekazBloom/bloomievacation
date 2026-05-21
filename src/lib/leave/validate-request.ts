import {
  fetchGrantsForUser,
  validateAnnualAllocationsAgainstGrants,
  type AnnualAllocationInput,
} from '@/lib/leave/entitlement-grants';
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
    annualAllocations?: AnnualAllocationInput[];
    /** Sick/religious: which project team pool to charge (required for sick). */
    balanceProjectId?: string;
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
  const poolProjectId = params.balanceProjectId ?? params.projectId;
  const useSickReligiousProjectPool =
    params.type === 'sick' || params.type === 'religious';

  const { data: membership, error: membershipError } =
    useProjectScopedFallback || useSickReligiousProjectPool
      ? await supabase
          .from('project_members')
          .select(
            'annual_leave_total, annual_leave_used, annual_leave_carried_over, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used'
          )
          .eq('project_id', poolProjectId)
          .eq('user_id', params.userId)
          .maybeSingle()
      : { data: null, error: null };

  if ((useProjectScopedFallback || useSickReligiousProjectPool) && membershipError) {
    return { ok: false as const, status: 500, error: membershipError.message };
  }

  const balanceSource =
    useSickReligiousProjectPool ? membership : globalBalance || membership;
  if (!balanceSource) {
    return {
      ok: false as const,
      status: 404,
      error: useProjectScopedFallback ? 'Project membership not found' : 'User leave balance not found',
    };
  }

  if (params.type === 'annual') {
    const grants = await fetchGrantsForUser(supabase, params.userId);
    if (grants.length > 0) {
      let allocations = params.annualAllocations;
      if ((!allocations || allocations.length === 0) && params.excludeRequestId) {
        const { data: allocRows } = await supabase
          .from('leave_request_grant_allocations')
          .select('grant_id, working_days')
          .eq('leave_request_id', params.excludeRequestId);
        allocations = (allocRows || []).map((r) => ({
          grantId: r.grant_id as string,
          workingDays: Number(r.working_days || 0),
        }));
      }
      if (!allocations || allocations.length === 0) {
        return {
          ok: false as const,
          status: 400,
          error:
            'Annual leave requires entitlement allocations. Submit how many days to take from each annual fund.',
        };
      }
      const grantCheck = await validateAnnualAllocationsAgainstGrants(supabase, {
        projectId: params.projectId,
        userId: params.userId,
        workingDays: params.workingDays,
        allocations,
        excludeLeaveRequestId: params.excludeRequestId,
      });
      if (!grantCheck.ok) {
        return grantCheck;
      }
      return { ok: true as const, membership: balanceSource };
    }
  }

  let pendingQuery = supabase
    .from('leave_requests')
    .select('id, type, working_days_count')
    .eq('user_id', params.userId)
    .eq('status', 'pending')
    .eq('type', params.type);

  if (useSickReligiousProjectPool) {
    pendingQuery = pendingQuery.eq('balance_project_id', poolProjectId);
  } else if (useProjectScopedFallback) {
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
