import { fundSourceShortLabel } from '@/lib/leave/fund-period-label';

type GrantRef =
  | { label?: string | null; source?: string | null; grant_year?: number | null }
  | { label?: string | null; source?: string | null; grant_year?: number | null }[]
  | null;

export type RequestAllocationRow = {
  working_days?: number | string | null;
  annual_entitlement_grants?: GrantRef;
};

/** Sick / religious pool label from balance_project_id when present. */
export function formatLeaveBalancePoolLine(
  leaveType: string,
  balanceProject?: { name?: string | null } | { name?: string | null }[] | null
): string | null {
  const project = Array.isArray(balanceProject) ? balanceProject[0] : balanceProject;
  const name = project?.name?.trim();
  if (leaveType === 'sick') {
    return name ? `Funds: Sick leave — ${name}` : 'Funds: Sick leave pool not selected';
  }
  if (leaveType === 'religious') {
    return name ? `Funds: Religious leave — ${name}` : 'Funds: Religious leave pool not selected';
  }
  return null;
}

/** Human-readable line for project request lists (annual leave only). */
export function formatAnnualRequestFundsSummary(
  allocations: RequestAllocationRow[] | null | undefined
): string {
  if (!allocations?.length) {
    return 'Funds: current annual pool (not split per fund in data)';
  }
  const parts: string[] = [];
  for (const row of allocations) {
    const g = row.annual_entitlement_grants;
    const grant = Array.isArray(g) ? g[0] : g;
    const rawLabel = grant?.label?.trim();
    const label =
      rawLabel && rawLabel.length > 0 ? rawLabel : fundSourceShortLabel(String(grant?.source ?? ''));
    const days = Number(row.working_days ?? 0);
    const suf = days === 1 ? '' : 's';
    parts.push(`${label}: ${days} day${suf}`);
  }
  return `Funds: ${parts.join(' · ')}`;
}
