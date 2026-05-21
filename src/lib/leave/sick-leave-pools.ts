import type { AppSupabase } from '@/lib/supabase/app-client';

export type SickLeavePoolOption = {
  projectId: string;
  projectName: string;
  sickTotal: number;
  sickUsed: number;
  sickRemaining: number;
};

export async function fetchSickLeavePoolsForUser(
  supabase: AppSupabase,
  userId: string
): Promise<SickLeavePoolOption[]> {
  const { data, error } = await supabase
    .from('project_members')
    .select('project_id, sick_leave_total, sick_leave_used, projects(name)')
    .eq('user_id', userId)
    .order('project_id', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => {
    const project = row.projects as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(project) ? project[0]?.name : project?.name;
    const total = Number(row.sick_leave_total ?? 0);
    const used = Number(row.sick_leave_used ?? 0);
    return {
      projectId: row.project_id as string,
      projectName: name || 'Project',
      sickTotal: total,
      sickUsed: used,
      sickRemaining: Math.max(0, total - used),
    };
  });
}

export function formatSickLeavePoolLabel(pool: SickLeavePoolOption): string {
  return `${pool.projectName} (${pool.sickRemaining.toFixed(0)} of ${pool.sickTotal.toFixed(0)} days left)`;
}
