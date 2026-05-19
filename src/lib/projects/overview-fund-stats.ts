import type { ProjectOverviewStats } from '@/lib/projects/overview';

export type AnnualFundDefinitionOption = {
  id: string;
  label: string;
};

export type OverviewGrantRow = {
  id: string;
  user_id: string;
  definition_id: string | null;
  days_allocated: number;
};

export type OverviewAllocationRow = {
  grant_id: string;
  leave_request_id: string;
  working_days: number;
  leave_requests: {
    status: string;
    type: string;
  } | null;
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
): { status: string; type: string } | null {
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
