import {
  fetchGrantIdsForUserDefinition,
  sharedPoolDaysAllocated,
  sumAllocatedAcrossDefinitionGrants,
} from '@/lib/leave/user-annual-funds-shared';
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
  definition_id?: string | null;
};

export type AnnualAllocationInput = { grantId: string; workingDays: number };

export function dateInGrantWindow(grant: Pick<AnnualGrantRow, 'valid_from' | 'valid_to'>, isoDate: string) {
  if (isoDate < grant.valid_from) return false;
  if (grant.valid_to && isoDate > grant.valid_to) return false;
  return true;
}

export type ProjectFirstUsePolicy = {
  firstUseMonth: number | null;
  firstUseDay: number | null;
};

export async function fetchProjectFirstUsePolicy(
  supabase: AppSupabase,
  projectId: string
): Promise<ProjectFirstUsePolicy> {
  const { data } = await supabase
    .from('projects')
    .select('annual_first_use_by_month, annual_first_use_by_day')
    .eq('id', projectId)
    .maybeSingle();

  return {
    firstUseMonth: (data?.annual_first_use_by_month as number | null) ?? null,
    firstUseDay: (data?.annual_first_use_by_day as number | null) ?? null,
  };
}

/** Grants that cover the first day of leave (employee/admin pick among these when multiple). */
export function grantsEligibleForStartDate(
  grants: AnnualGrantRow[],
  startDate: string,
  policy?: ProjectFirstUsePolicy
) {
  return grants.filter((g) => {
    if (policy?.firstUseMonth != null && policy?.firstUseDay != null) {
      return dateInGrantBookableWindow(g, startDate, policy.firstUseMonth, policy.firstUseDay);
    }
    return dateInGrantWindow(g, startDate);
  });
}

/** When several funds cover the same start date, pick the most specific grant row. */
export function pickBestGrantForStartDate(grants: AnnualGrantRow[], startDate: string): AnnualGrantRow {
  if (grants.length === 1) return grants[0];

  const startYear = Number(startDate.slice(0, 4));
  const sameYear = Number.isFinite(startYear)
    ? grants.filter((g) => g.grant_year === startYear)
    : [];
  if (sameYear.length === 1) return sameYear[0];
  if (sameYear.length > 1) {
    const nonLegacy = sameYear.filter((g) => g.source !== 'legacy_migration');
    if (nonLegacy.length === 1) return nonLegacy[0];
    if (nonLegacy.length > 0) {
      return [...nonLegacy].sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
    }
  }

  const nonLegacy = grants.filter((g) => g.source !== 'legacy_migration');
  if (nonLegacy.length === 1) return nonLegacy[0];
  if (nonLegacy.length > 0) {
    return [...nonLegacy].sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
  }

  return [...grants].sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
}

/**
 * Re-attach pending/approved annual requests to the grant whose validity window matches start_date.
 * Fixes legacy backfill that put everything on legacy_migration.
 */
export async function realignAnnualGrantAllocationsForMember(
  supabase: AppSupabase,
  projectId: string,
  userId: string
): Promise<{ error: string | null; updated: number }> {
  const grants = await fetchGrantsForMember(supabase, projectId, userId);
  if (grants.length === 0) return { error: null, updated: 0 };

  const { data: requests, error: reqErr } = await supabase
    .from('leave_requests')
    .select('id, start_date, working_days_count')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('type', 'annual')
    .in('status', ['pending', 'approved']);

  if (reqErr) return { error: reqErr.message, updated: 0 };

  const policy = await fetchProjectFirstUsePolicy(supabase, projectId);
  let updated = 0;

  for (const lr of requests || []) {
    const startDate = lr.start_date as string;
    const workingDays = Number(lr.working_days_count ?? 0);
    if (!startDate || !Number.isFinite(workingDays) || workingDays <= 0) continue;

    const eligible = grantsEligibleForStartDate(grants, startDate, policy);
    if (eligible.length === 0) continue;

    const target = pickBestGrantForStartDate(eligible, startDate);

    const { data: existing } = await supabase
      .from('leave_request_grant_allocations')
      .select('grant_id, working_days')
      .eq('leave_request_id', lr.id as string);

    const rows = existing || [];
    const eligibleIds = new Set(eligible.map((g) => g.id));

    if (rows.length === 1 && !eligibleIds.has(rows[0].grant_id as string)) {
      continue;
    }

    if (rows.length > 1) {
      continue;
    }

    const alreadyCorrect =
      rows.length === 1 &&
      rows[0].grant_id === target.id &&
      Math.abs(Number(rows[0].working_days || 0) - workingDays) < 0.001;

    if (alreadyCorrect) continue;

    const { error: delErr } = await supabase
      .from('leave_request_grant_allocations')
      .delete()
      .eq('leave_request_id', lr.id as string);
    if (delErr) return { error: delErr.message, updated };

    const { error: insErr } = await supabase.from('leave_request_grant_allocations').insert({
      leave_request_id: lr.id as string,
      grant_id: target.id,
      working_days: workingDays,
    });
    if (insErr) return { error: insErr.message, updated };

    updated += 1;
  }

  return { error: null, updated };
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

/** Last calendar day leave can start/end for this grant (policy extends past stored valid_to). */
export function resolveGrantBookableEnd(
  grant: Pick<AnnualGrantRow, 'grant_year' | 'valid_to'>,
  firstUseMonth: number | null | undefined,
  firstUseDay: number | null | undefined
): string | null {
  const policyEnd =
    grant.grant_year != null
      ? firstUseByDateForGrantYear(grant.grant_year, firstUseMonth, firstUseDay)
      : null;
  const stored = grant.valid_to;
  if (!policyEnd) return stored;
  if (!stored) return policyEnd;
  return stored >= policyEnd ? stored : policyEnd;
}

export function dateInGrantBookableWindow(
  grant: Pick<AnnualGrantRow, 'valid_from' | 'grant_year' | 'valid_to'>,
  isoDate: string,
  firstUseMonth: number | null | undefined,
  firstUseDay: number | null | undefined
): boolean {
  const validTo = resolveGrantBookableEnd(grant, firstUseMonth, firstUseDay);
  return dateInGrantWindow({ valid_from: grant.valid_from, valid_to: validTo }, isoDate);
}

/** User picked grant(s) in the form — skip calendar-window checks on start date. */
export function validateExplicitAnnualAllocations(
  grants: AnnualGrantRow[],
  allocations: AnnualAllocationInput[]
): { ok: true } | { ok: false; error: string } {
  const grantById = new Map(grants.map((g) => [g.id, g]));
  for (const row of allocations) {
    if (!grantById.has(row.grantId)) {
      return { ok: false, error: 'Unknown entitlement grant in allocation.' };
    }
  }
  return { ok: true };
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
    .select(
      'id, project_id, user_id, grant_year, label, days_allocated, valid_from, valid_to, source, definition_id'
    )
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

    const definitionId = grant.definition_id ?? null;
    const poolGrantIds = await fetchGrantIdsForUserDefinition(
      supabase,
      params.userId,
      definitionId,
      row.grantId
    );
    const consumed = await sumAllocatedAcrossDefinitionGrants(supabase, poolGrantIds, {
      excludeLeaveRequestId: params.excludeLeaveRequestId,
    });
    const poolDays = await sharedPoolDaysAllocated(
      supabase,
      params.userId,
      definitionId,
      Number(grant.days_allocated || 0)
    );
    const remaining = poolDays - consumed;
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
  const [grants, policy] = await Promise.all([
    fetchGrantsForMember(supabase, projectId, userId),
    fetchProjectFirstUsePolicy(supabase, projectId),
  ]);
  const eligible = grantsEligibleForStartDate(grants, startDate, policy);
  const eligibleSummaries: Array<
    Pick<AnnualGrantRow, 'id' | 'label' | 'grant_year' | 'valid_from' | 'valid_to'> & { remaining: number }
  > = [];

  for (const g of eligible) {
    const poolGrantIds = await fetchGrantIdsForUserDefinition(
      supabase,
      userId,
      g.definition_id ?? null,
      g.id
    );
    const consumed = await sumAllocatedAcrossDefinitionGrants(supabase, poolGrantIds);
    const poolDays = await sharedPoolDaysAllocated(
      supabase,
      userId,
      g.definition_id ?? null,
      Number(g.days_allocated || 0)
    );
    eligibleSummaries.push({
      id: g.id,
      label: g.label,
      grant_year: g.grant_year,
      valid_from: g.valid_from,
      valid_to: resolveGrantBookableEnd(g, policy.firstUseMonth, policy.firstUseDay),
      remaining: poolDays - consumed,
    });
  }

  return { eligible: eligibleSummaries, requiresSplit: eligible.length >= 2 };
}

export async function replaceAnnualAllocations(
  supabase: AppSupabase,
  leaveRequestId: string,
  allocations: AnnualAllocationInput[]
) {
  const { error: deleteError } = await supabase
    .from('leave_request_grant_allocations')
    .delete()
    .eq('leave_request_id', leaveRequestId);
  if (deleteError) return { error: deleteError };

  if (allocations.length === 0) return { error: null };

  const rows = allocations.map((a) => ({
    leave_request_id: leaveRequestId,
    grant_id: a.grantId,
    working_days: a.workingDays,
  }));
  const { error: insertError } = await supabase.from('leave_request_grant_allocations').insert(rows);
  return { error: insertError };
}
