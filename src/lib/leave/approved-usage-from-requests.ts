import type { AppSupabase } from '@/lib/supabase/app-client';

export type ApprovedUsageByType = {
  annual: number;
  sick: number;
  religious: number;
};

const emptyUsage = (): ApprovedUsageByType => ({ annual: 0, sick: 0, religious: 0 });

function addToBucket(bucket: ApprovedUsageByType, type: string, days: number) {
  if (type === 'annual') bucket.annual += days;
  else if (type === 'sick') bucket.sick += days;
  else if (type === 'religious') bucket.religious += days;
}

/**
 * Sum approved working days per user across all projects.
 * Use this for UI when someone is on multiple teams so "used" matches everywhere
 * (totals still come from project_members for the current project).
 *
 * For annual leave with grant splits, each approved request still has a single
 * `working_days_count`; allocations per grant sum to that value, so this global
 * sum stays aligned with `project_members.annual_leave_used` / balance triggers.
 */
export async function fetchApprovedUsageGloballyForUsers(
  supabase: AppSupabase,
  userIds: string[]
): Promise<Map<string, ApprovedUsageByType>> {
  const map = new Map<string, ApprovedUsageByType>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .select('user_id, type, working_days_count')
    .in('user_id', unique)
    .eq('status', 'approved');

  if (error || !data) {
    return map;
  }

  for (const row of data) {
    const uid = row.user_id as string;
    const days = Number(row.working_days_count ?? 0);
    if (!uid || !Number.isFinite(days)) continue;

    let bucket = map.get(uid);
    if (!bucket) {
      bucket = emptyUsage();
      map.set(uid, bucket);
    }
    addToBucket(bucket, row.type as string, days);
  }

  return map;
}

export async function fetchApprovedUsageGloballyForUser(
  supabase: AppSupabase,
  userId: string
): Promise<ApprovedUsageByType> {
  const map = await fetchApprovedUsageGloballyForUsers(supabase, [userId]);
  return map.get(userId) ?? emptyUsage();
}
