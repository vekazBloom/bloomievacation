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

/** Sum approved working days per user for one project (matches calendar / leave history). */
export async function fetchApprovedUsageByUserForProject(
  supabase: AppSupabase,
  projectId: string
): Promise<Map<string, ApprovedUsageByType>> {
  const map = new Map<string, ApprovedUsageByType>();

  const { data, error } = await supabase
    .from('leave_requests')
    .select('user_id, type, working_days_count')
    .eq('project_id', projectId)
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

export async function fetchApprovedUsageForMember(
  supabase: AppSupabase,
  projectId: string,
  userId: string
): Promise<ApprovedUsageByType> {
  const { data, error } = await supabase
    .from('leave_requests')
    .select('type, working_days_count')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'approved');

  if (error || !data) {
    return emptyUsage();
  }

  const bucket = emptyUsage();
  for (const row of data) {
    addToBucket(bucket, row.type as string, Number(row.working_days_count ?? 0));
  }
  return bucket;
}
