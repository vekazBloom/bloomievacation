import type { AppSupabase } from '@/lib/supabase/app-client';

export type AdminProjectCountRow = {
  project_id: string;
  member_count: number;
  pending_count: number;
  away_this_week_count: number;
};

export async function fetchAdminProjectCounts(
  supabase: AppSupabase,
  today: string,
  weekEndIso: string
) {
  const { data, error } = await supabase.rpc('admin_project_dashboard_counts', {
    p_today: today,
    p_week_end: weekEndIso,
  });

  if (error) {
    throw error;
  }

  return (data || []) as AdminProjectCountRow[];
}

export async function fetchAdminProjectCountsFallback(
  supabase: AppSupabase,
  projectIds: string[],
  today: string,
  weekEndIso: string
) {
  if (projectIds.length === 0) {
    return [] as AdminProjectCountRow[];
  }

  const [{ data: memberRows }, { data: pendingRows }, { data: awayRows }] = await Promise.all([
    supabase.from('project_members').select('project_id').in('project_id', projectIds),
    supabase
      .from('leave_requests')
      .select('project_id')
      .in('project_id', projectIds)
      .eq('status', 'pending'),
    supabase
      .from('leave_requests')
      .select('project_id, user_id')
      .in('project_id', projectIds)
      .eq('status', 'approved')
      .lte('start_date', weekEndIso)
      .gte('end_date', today),
  ]);

  const memberCounts: Record<string, number> = {};
  const pendingCounts: Record<string, number> = {};
  const awayCounts: Record<string, number> = {};

  (memberRows || []).forEach((row: { project_id: string }) => {
    memberCounts[row.project_id] = (memberCounts[row.project_id] || 0) + 1;
  });

  (pendingRows || []).forEach((row: { project_id: string }) => {
    pendingCounts[row.project_id] = (pendingCounts[row.project_id] || 0) + 1;
  });

  const awayByProject: Record<string, Set<string>> = {};
  (awayRows || []).forEach((row: { project_id: string; user_id: string }) => {
    if (!awayByProject[row.project_id]) {
      awayByProject[row.project_id] = new Set();
    }
    awayByProject[row.project_id].add(row.user_id);
  });

  Object.entries(awayByProject).forEach(([projectId, userIds]) => {
    awayCounts[projectId] = userIds.size;
  });

  return projectIds.map((projectId) => ({
    project_id: projectId,
    member_count: memberCounts[projectId] || 0,
    pending_count: pendingCounts[projectId] || 0,
    away_this_week_count: awayCounts[projectId] || 0,
  }));
}
