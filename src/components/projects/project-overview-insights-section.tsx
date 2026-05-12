import { ProjectOverviewInsights } from '@/components/projects/project-overview-insights';
import { getDashboardSession } from '@/lib/auth/dashboard';
import {
  fetchProjectUpcomingRequests,
  loadProjectOverviewMetrics,
  mapUpcomingLeaveRequests,
} from '@/lib/projects/overview-data';
import { buildProjectOverviewStats } from '@/lib/projects/overview';

export async function ProjectOverviewInsightsSection({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const session = await getDashboardSession();
  if (!session) {
    return null;
  }

  const { supabase } = session;
  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndIso = weekEnd.toISOString().split('T')[0];
  const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  const [{ data: members }, metrics, upcomingRequests] = await Promise.all([
    supabase
      .from('project_members')
      .select(
        'annual_leave_total, annual_leave_used, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used, users(name)'
      )
      .eq('project_id', projectId),
    loadProjectOverviewMetrics(supabase, projectId, today, weekEndIso, monthStart),
    fetchProjectUpcomingRequests(supabase, projectId, today),
  ]);

  const overviewStats = buildProjectOverviewStats(
    (members || []) as any[],
    metrics,
    mapUpcomingLeaveRequests(upcomingRequests)
  );

  return <ProjectOverviewInsights projectSlug={projectSlug} stats={overviewStats} />;
}
