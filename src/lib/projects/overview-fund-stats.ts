import type { ProjectOverviewStats } from '@/lib/projects/overview';
import {
  fetchProjectFirstUsePolicy,
  grantsEligibleForStartDate,
  pickBestGrantForStartDate,
  type AnnualGrantRow,
  type ProjectFirstUsePolicy,
} from '@/lib/leave/entitlement-grants';
import type { AppSupabase } from '@/lib/supabase/app-client';

export type AnnualFundDefinitionOption = {
  id: string;
  label: string;
};

export type OverviewGrantRow = {
  id: string;
  user_id: string;
  definition_id: string | null;
  days_allocated: number;
  valid_from: string;
  valid_to: string | null;
  grant_year?: number | null;
  source?: string;
};

export type OverviewAllocationRow = {
  grant_id: string;
  leave_request_id: string;
  working_days: number;
  leave_requests: {
    status: string;
    type: string;
    start_date: string;
    user_id: string;
  } | null;
};

export type MemberFundBalanceRow = {
  used: number;
  total: number;
  reserved: number;
};

export type AnnualBalanceRequestRow = {
  id: string;
  user_id: string;
  status: string;
  start_date: string;
  working_days_count: number;
};

export type MemberAnnualBalancesResult = {
  byDefinition: Record<string, Record<string, MemberFundBalanceRow>>;
  byGrantId: Record<string, MemberFundBalanceRow>;
  attributedGrantByRequestId: Record<string, string>;
};

export type FundScopedOverviewSlice = {
  utilization: {
    annualUsed: number;
    annualTotal: number;
  };
  leaveTypeCounts: {
    annual: number;
  };
  statusCounts: ProjectOverviewStats['statusCounts'];
  memberUtilization: Array<{
    name: string;
    annualPct: number;
  }>;
};

function pct(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

function normalizeLeaveRequest(
  row: OverviewAllocationRow['leave_requests']
): { status: string; type: string; start_date: string; user_id: string } | null {
  if (!row) return null;
  if (Array.isArray(row)) return row[0] ?? null;
  return row;
}

export function buildFundScopedOverviewStats(
  definitions: AnnualFundDefinitionOption[],
  grants: OverviewGrantRow[],
  allocations: OverviewAllocationRow[],
  memberNamesByUserId: Map<string, string>
): Record<string, FundScopedOverviewSlice> {
  const grantsById = new Map(grants.map((grant) => [grant.id, grant]));
  const result: Record<string, FundScopedOverviewSlice> = {};

  for (const definition of definitions) {
    const fundGrants = grants.filter((grant) => grant.definition_id === definition.id);
    const fundGrantIds = new Set(fundGrants.map((grant) => grant.id));

    const annualTotal = fundGrants.reduce(
      (sum, grant) => sum + Number(grant.days_allocated || 0),
      0
    );

    let annualUsed = 0;
    const annualRequestIds = new Set<string>();
    const statusRequestIds = {
      pending: new Set<string>(),
      approved: new Set<string>(),
      rejected: new Set<string>(),
      cancelled: new Set<string>(),
    };

    for (const allocation of allocations) {
      if (!fundGrantIds.has(allocation.grant_id)) continue;

      const leaveRequest = normalizeLeaveRequest(allocation.leave_requests);
      if (!leaveRequest) continue;

      const days = Number(allocation.working_days || 0);
      const requestId = allocation.leave_request_id;

      if (leaveRequest.type === 'annual') {
        annualRequestIds.add(requestId);
      }

      if (leaveRequest.status === 'pending') statusRequestIds.pending.add(requestId);
      if (leaveRequest.status === 'approved') {
        statusRequestIds.approved.add(requestId);
        annualUsed += days;
      }
      if (leaveRequest.status === 'rejected') statusRequestIds.rejected.add(requestId);
      if (leaveRequest.status === 'cancelled') statusRequestIds.cancelled.add(requestId);
    }

    const usedByUser = new Map<string, number>();
    const totalByUser = new Map<string, number>();

    for (const grant of fundGrants) {
      totalByUser.set(
        grant.user_id,
        (totalByUser.get(grant.user_id) || 0) + Number(grant.days_allocated || 0)
      );
    }

    for (const allocation of allocations) {
      if (!fundGrantIds.has(allocation.grant_id)) continue;
      const leaveRequest = normalizeLeaveRequest(allocation.leave_requests);
      if (leaveRequest?.status !== 'approved') continue;

      const grant = grantsById.get(allocation.grant_id);
      if (!grant) continue;

      const days = Number(allocation.working_days || 0);
      usedByUser.set(grant.user_id, (usedByUser.get(grant.user_id) || 0) + days);
    }

    const memberUtilization = [...totalByUser.entries()]
      .map(([userId, total]) => {
        const used = usedByUser.get(userId) || 0;
        return {
          name: memberNamesByUserId.get(userId) || 'Team member',
          annualPct: pct(used, total),
        };
      })
      .sort((left, right) => right.annualPct - left.annualPct)
      .slice(0, 6);

    result[definition.id] = {
      utilization: { annualUsed, annualTotal },
      leaveTypeCounts: { annual: annualRequestIds.size },
      statusCounts: {
        pending: statusRequestIds.pending.size,
        approved: statusRequestIds.approved.size,
        rejected: statusRequestIds.rejected.size,
        cancelled: statusRequestIds.cancelled.size,
      },
      memberUtilization,
    };
  }

  return result;
}

function toGrantPickerRow(grant: OverviewGrantRow): AnnualGrantRow {
  return {
    id: grant.id,
    project_id: '',
    user_id: grant.user_id,
    grant_year: grant.grant_year ?? null,
    label: '',
    days_allocated: grant.days_allocated,
    valid_from: grant.valid_from,
    valid_to: grant.valid_to,
    source: grant.source ?? 'grant',
  };
}

function emptyBalance(): MemberFundBalanceRow {
  return { used: 0, total: 0, reserved: 0 };
}

function addDaysToBalance(
  balance: MemberFundBalanceRow,
  days: number,
  status: string
): MemberFundBalanceRow {
  const next = { ...balance };
  if (status === 'approved') {
    next.used += days;
    next.reserved += days;
  } else if (status === 'pending') {
    next.reserved += days;
  }
  return next;
}

function attributeGrantForRequest(
  grants: OverviewGrantRow[],
  pickerGrants: AnnualGrantRow[],
  grantsById: Map<string, OverviewGrantRow>,
  request: AnnualBalanceRequestRow,
  policy?: ProjectFirstUsePolicy
): OverviewGrantRow | null {
  const memberPickerGrants = pickerGrants.filter((grant) => grant.user_id === request.user_id);
  const eligible = grantsEligibleForStartDate(memberPickerGrants, request.start_date, policy);
  if (eligible.length === 0) return null;
  const targetGrant = pickBestGrantForStartDate(eligible, request.start_date);
  return grantsById.get(targetGrant.id) ?? null;
}

/** Per-member annual used/total/reserved per fund (matches approved leave_requests, not raw allocation rows). */
export function buildMemberAnnualBalances(
  definitions: AnnualFundDefinitionOption[],
  grants: OverviewGrantRow[],
  requests: AnnualBalanceRequestRow[],
  policy?: ProjectFirstUsePolicy
): MemberAnnualBalancesResult {
  const grantsById = new Map(grants.map((grant) => [grant.id, grant]));
  const pickerGrants = grants.map(toGrantPickerRow);
  const byDefinition: Record<string, Record<string, MemberFundBalanceRow>> = {};
  const byGrantId: Record<string, MemberFundBalanceRow> = {};
  const attributedGrantByRequestId: Record<string, string> = {};

  for (const definition of definitions) {
    byDefinition[definition.id] = {};
  }

  for (const grant of grants) {
    const total = Number(grant.days_allocated || 0);
    if (grant.definition_id) {
      const byUser = byDefinition[grant.definition_id] || {};
      const current = byUser[grant.user_id] || emptyBalance();
      current.total += total;
      byUser[grant.user_id] = current;
      byDefinition[grant.definition_id] = byUser;
    } else {
      const current = byGrantId[grant.id] || emptyBalance();
      current.total += total;
      byGrantId[grant.id] = current;
    }
  }

  const countedRequestIds = new Set<string>();

  for (const request of requests) {
    if (!request.id || countedRequestIds.has(request.id)) continue;
    countedRequestIds.add(request.id);

    const days = Number(request.working_days_count ?? 0);
    if (!Number.isFinite(days) || days <= 0) continue;

    const targetOverview = attributeGrantForRequest(
      grants,
      pickerGrants,
      grantsById,
      request,
      policy
    );
    if (!targetOverview) continue;

    attributedGrantByRequestId[request.id] = targetOverview.id;

    if (targetOverview.definition_id) {
      const byUser = byDefinition[targetOverview.definition_id] || {};
      const current = byUser[request.user_id] || emptyBalance();
      byUser[request.user_id] = addDaysToBalance(current, days, request.status);
      byDefinition[targetOverview.definition_id] = byUser;
    } else {
      const current = byGrantId[targetOverview.id] || emptyBalance();
      byGrantId[targetOverview.id] = addDaysToBalance(current, days, request.status);
    }
  }

  return { byDefinition, byGrantId, attributedGrantByRequestId };
}

/** @deprecated Use buildMemberAnnualBalances — kept for callers passing allocation joins. */
export function buildMemberAnnualBalancesByFund(
  definitions: AnnualFundDefinitionOption[],
  grants: OverviewGrantRow[],
  allocations: OverviewAllocationRow[],
  policy?: ProjectFirstUsePolicy
): Record<string, Record<string, MemberFundBalanceRow>> {
  const requests: AnnualBalanceRequestRow[] = [];
  const seen = new Set<string>();

  for (const allocation of allocations) {
    const leaveRequest = normalizeLeaveRequest(allocation.leave_requests);
    if (!leaveRequest || leaveRequest.type !== 'annual') continue;
    if (seen.has(allocation.leave_request_id)) continue;
    seen.add(allocation.leave_request_id);
    requests.push({
      id: allocation.leave_request_id,
      user_id: leaveRequest.user_id,
      status: leaveRequest.status,
      start_date: leaveRequest.start_date,
      working_days_count: Number(allocation.working_days || 0),
    });
  }

  return buildMemberAnnualBalances(definitions, grants, requests, policy).byDefinition;
}

export async function loadProjectAnnualBalanceInputs(
  supabase: AppSupabase,
  projectId: string
): Promise<{
  definitions: AnnualFundDefinitionOption[];
  grants: OverviewGrantRow[];
  requests: AnnualBalanceRequestRow[];
  policy: ProjectFirstUsePolicy;
}> {
  const [{ data: fundDefinitions }, { data: grants }, { data: requests }, policy] = await Promise.all([
    supabase
      .from('annual_fund_definitions')
      .select('id, label')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true }),
    supabase
      .from('annual_entitlement_grants')
      .select('id, user_id, definition_id, days_allocated, valid_from, valid_to, grant_year, source')
      .eq('project_id', projectId),
    supabase
      .from('leave_requests')
      .select('id, user_id, status, start_date, working_days_count')
      .eq('project_id', projectId)
      .eq('type', 'annual')
      .in('status', ['pending', 'approved']),
    fetchProjectFirstUsePolicy(supabase, projectId),
  ]);

  return {
    definitions: (fundDefinitions || []).map((row) => ({
      id: row.id as string,
      label: row.label as string,
    })),
    grants: (grants || []) as OverviewGrantRow[],
    requests: (requests || []).map((row) => ({
      id: row.id as string,
      user_id: row.user_id as string,
      status: row.status as string,
      start_date: row.start_date as string,
      working_days_count: Number(row.working_days_count ?? 0),
    })),
    policy,
  };
}
