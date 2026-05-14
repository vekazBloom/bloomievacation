import type { AppSupabase } from '@/lib/supabase/app-client';

export type AnnualGrantRow = {
  id: string;
  project_id: string;
  user_id: string;
  grant_year: number | null;
  label: string;
  days_allocated: number;
  valid_from: string;
  valid_to: string | null;
  source: string;
};

export type AnnualAllocationInput = { grantId: string; workingDays: number };

export function dateInGrantWindow(grant: Pick<AnnualGrantRow, 'valid_from' | 'valid_to'>, isoDate: string) {
  if (isoDate < grant.valid_from) return false;
  if (grant.valid_to && isoDate > grant.valid_to) return false;
  return true;
}

/** Grants that cover the first day of leave (employee/admin pick among these when multiple). */
export function grantsEligibleForStartDate(grants: AnnualGrantRow[], startDate: string) {
  return grants.filter((g) => dateInGrantWindow(g, startDate));
}

export function firstUseByDateForGrantYear(
  grantYear: number,
  month: number | null | undefined,
  day: number | null | undefined
): string | null {
  if (!month || !day) return null;
  const y = grantYear + 1;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function accrualDateForGrantYear(
  grantYear: number,
  accrualMonth: number,
  accrualDay: number
): string {
  return `${grantYear}-${String(accrualMonth).padStart(2, '0')}-${String(accrualDay).padStart(2, '0')}`;
}

export async function fetchGrantsForMember(
  supabase: AppSupabase,
  projectId: string,
  userId: string
): Promise<AnnualGrantRow[]> {
  const { data, error } = await supabase
    .from('annual_entitlement_grants')
    .select('id, project_id, user_id, grant_year, label, days_allocated, valid_from, valid_to, source')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('valid_from', { ascending: true });

  if (error || !data) return [];
  return data as AnnualGrantRow[];
}

export async function sumAllocatedToGrant(
  supabase: AppSupabase,
  grantId: string,
  options?: { excludeLeaveRequestId?: string; statuses?: ('pending' | 'approved')[] }
): Promise<number> {
  const statuses = options?.statuses ?? ['pending', 'approved'];

  const { data, error } = await supabase
    .from('leave_request_grant_allocations')
    .select('working_days, leave_request_id, leave_requests(status)')
    .eq('grant_id', grantId);

  if (error || !data) return 0;

  let sum = 0;
  for (const row of data) {
    const typed = row as {
      working_days: number | string;
      leave_request_id: string;
      leave_requests: { status: string } | { status: string }[] | null;
    };
    if (options?.excludeLeaveRequestId && typed.leave_request_id === options.excludeLeaveRequestId) {
      continue;
    }
    const lr = typed.leave_requests;
    const status = Array.isArray(lr) ? lr[0]?.status : lr?.status;
    if (!status || !statuses.includes(status as 'pending' | 'approved')) continue;
    sum += Number(typed.working_days || 0);
  }
  return sum;
}

export function grantRemaining(grant: Pick<AnnualGrantRow, 'days_allocated'>, consumed: number) {
  return Number(grant.days_allocated || 0) - consumed;
}

export function validateAllocationTotals(
  allocations: AnnualAllocationInput[],
  expectedWorkingDays: number
): { ok: true } | { ok: false; error: string } {
  const sum = allocations.reduce((s, a) => s + Number(a.workingDays || 0), 0);
  if (Math.abs(sum - expectedWorkingDays) > 0.001) {
    return {
      ok: false,
      error: `Annual allocations must sum to ${expectedWorkingDays} working day(s). Currently ${sum}.`,
    };
  }
  if (allocations.some((a) => a.workingDays <= 0)) {
    return { ok: false, error: 'Each allocation must be greater than zero.' };
  }
  return { ok: true };
}

export async function validateAnnualAllocationsAgainstGrants(
  supabase: AppSupabase,
  params: {
    projectId: string;
    userId: string;
    workingDays: number;
    allocations: AnnualAllocationInput[];
    excludeLeaveRequestId?: string;
  }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const totalCheck = validateAllocationTotals(params.allocations, params.workingDays);
  if (!totalCheck.ok) {
    return { ok: false, status: 400, error: totalCheck.error };
  }

  const grants = await fetchGrantsForMember(supabase, params.projectId, params.userId);
  const grantById = new Map(grants.map((g) => [g.id, g]));

  for (const row of params.allocations) {
    const grant = grantById.get(row.grantId);
    if (!grant) {
      return { ok: false, status: 400, error: 'Unknown entitlement grant in allocation.' };
    }
    if (grant.project_id !== params.projectId || grant.user_id !== params.userId) {
      return { ok: false, status: 400, error: 'Grant does not belong to this member/project.' };
    }

    const consumed = await sumAllocatedToGrant(supabase, row.grantId, {
      excludeLeaveRequestId: params.excludeLeaveRequestId,
    });
    const remaining = grantRemaining(grant, consumed);
    if (row.workingDays > remaining + 1e-6) {
      return {
        ok: false,
        status: 400,
        error: `Not enough days left on grant "${grant.label || grant.id}". Remaining: ${remaining.toFixed(1)}.`,
      };
    }
  }

  return { ok: true };
}

export async function fetchAnnualGrantSplitHints(
  supabase: AppSupabase,
  projectId: string,
  userId: string,
  startDate: string
): Promise<{
  eligible: Array<
    Pick<AnnualGrantRow, 'id' | 'label' | 'grant_year' | 'valid_from' | 'valid_to'> & { remaining: number }
  >;
  requiresSplit: boolean;
}> {
  const grants = await fetchGrantsForMember(supabase, projectId, userId);
  const eligible = grantsEligibleForStartDate(grants, startDate);
  const eligibleSummaries: Array<
    Pick<AnnualGrantRow, 'id' | 'label' | 'grant_year' | 'valid_from' | 'valid_to'> & { remaining: number }
  > = [];

  for (const g of eligible) {
    const consumed = await sumAllocatedToGrant(supabase, g.id);
    eligibleSummaries.push({
      id: g.id,
      label: g.label,
      grant_year: g.grant_year,
      valid_from: g.valid_from,
      valid_to: g.valid_to,
      remaining: grantRemaining(g, consumed),
    });
  }

  return { eligible: eligibleSummaries, requiresSplit: eligible.length >= 2 };
}

export async function replaceAnnualAllocations(
  supabase: AppSupabase,
  leaveRequestId: string,
  allocations: AnnualAllocationInput[]
) {
  await supabase.from('leave_request_grant_allocations').delete().eq('leave_request_id', leaveRequestId);
  if (allocations.length === 0) return { error: null };
  const rows = allocations.map((a) => ({
    leave_request_id: leaveRequestId,
    grant_id: a.grantId,
    working_days: a.workingDays,
  }));
  return supabase.from('leave_request_grant_allocations').insert(rows);
}
