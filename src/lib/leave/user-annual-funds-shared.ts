import type { OverviewGrantRow } from '@/lib/projects/overview-fund-stats';
import type { AppSupabase } from '@/lib/supabase/app-client';

export type UserGrantRow = OverviewGrantRow & {
  project_id?: string;
  label?: string;
  source?: string;
};

function grantPickScore(grant: UserGrantRow, preferredProjectId?: string): number {
  let score = Number(grant.days_allocated || 0);
  if (grant.source === 'legacy_migration') score += 10_000;
  if (preferredProjectId && grant.project_id === preferredProjectId) score += 1_000;
  return score;
}

/** One pool per user × fund template (max allocated days), shared across all projects. */
export function mergeGrantsPerUserByDefinition(
  grants: UserGrantRow[],
  preferredProjectId?: string
): OverviewGrantRow[] {
  const byKey = new Map<string, UserGrantRow>();

  for (const grant of grants) {
    const key = `${grant.user_id}:${grant.definition_id ?? grant.id}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...grant });
      continue;
    }

    const days = Math.max(Number(existing.days_allocated || 0), Number(grant.days_allocated || 0));
    const winner =
      grantPickScore(grant, preferredProjectId) >= grantPickScore(existing, preferredProjectId)
        ? grant
        : existing;

    byKey.set(key, { ...winner, days_allocated: days });
  }

  return [...byKey.values()];
}

/** Grant row in `preferredProjectId` for edits/API, else best match for template. */
export function pickGrantIdForProject(
  grants: UserGrantRow[],
  userId: string,
  definitionId: string | null,
  grantRowId: string,
  preferredProjectId: string
): string {
  const related = grants.filter((g) => g.user_id === userId);
  if (!definitionId) {
    return (
      related.find((g) => g.id === grantRowId && g.project_id === preferredProjectId)?.id ??
      related.find((g) => g.id === grantRowId)?.id ??
      grantRowId
    );
  }

  return (
    related.find((g) => g.definition_id === definitionId && g.project_id === preferredProjectId)?.id ??
    related.find((g) => g.definition_id === definitionId)?.id ??
    grantRowId
  );
}

export async function fetchGrantIdsForUserDefinition(
  supabase: AppSupabase,
  userId: string,
  definitionId: string | null,
  fallbackGrantId: string
): Promise<string[]> {
  if (!definitionId) return [fallbackGrantId];

  const { data, error } = await supabase
    .from('annual_entitlement_grants')
    .select('id')
    .eq('user_id', userId)
    .eq('definition_id', definitionId);

  if (error || !data?.length) return [fallbackGrantId];
  return data.map((row) => row.id as string);
}

export async function sumAllocatedAcrossDefinitionGrants(
  supabase: AppSupabase,
  grantIds: string[],
  options?: { excludeLeaveRequestId?: string; statuses?: ('pending' | 'approved')[] }
): Promise<number> {
  if (grantIds.length === 0) return 0;

  const statuses = options?.statuses ?? ['pending', 'approved'];
  const { data, error } = await supabase
    .from('leave_request_grant_allocations')
    .select('working_days, leave_request_id, leave_requests(status)')
    .in('grant_id', grantIds);

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

export async function sharedPoolDaysAllocated(
  supabase: AppSupabase,
  userId: string,
  definitionId: string | null,
  fallbackDays: number
): Promise<number> {
  if (!definitionId) return fallbackDays;

  const { data, error } = await supabase
    .from('annual_entitlement_grants')
    .select('days_allocated')
    .eq('user_id', userId)
    .eq('definition_id', definitionId);

  if (error || !data?.length) return fallbackDays;

  return Math.max(...data.map((row) => Number(row.days_allocated ?? 0)));
}
