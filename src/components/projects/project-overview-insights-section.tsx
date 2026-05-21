import { ProjectOverviewInsights } from '@/components/projects/project-overview-insights';
import { fetchApprovedUsageGloballyForUsers } from '@/lib/leave/approved-usage-from-requests';
import { getDashboardSession } from '@/lib/auth/dashboard';
import {
  fetchProjectUpcomingRequests,
  loadProjectOverviewMetrics,
  mapUpcomingLeaveRequests,
} from '@/lib/projects/overview-data';
import { buildProjectOverviewStats } from '@/lib/projects/overview';
import {
  buildFundScopedOverviewStats,
  loadProjectAnnualBalanceInputs,
  pickDefaultAnnualFundDefinitionId,
  type OverviewAllocationRow,
  type OverviewGrantRow,
} from '@/lib/projects/overview-fund-stats';

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

  const [{ data: members }, metrics, upcomingRequests, balanceInputs] = await Promise.all([
    supabase
      .from('project_members')
      .select(
        'user_id, annual_leave_total, annual_leave_used, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used, users(name)'
      )
      .eq('project_id', projectId),
    loadProjectOverviewMetrics(supabase, projectId, today, weekEndIso, monthStart),
    fetchProjectUpcomingRequests(supabase, projectId, today),
    loadProjectAnnualBalanceInputs(supabase, projectId),
  ]);

  const grants = balanceInputs.grants;
  const grantIds = grants.map((grant) => grant.id).filter(Boolean);
  const { data: allocations } =
    grantIds.length > 0
      ? await supabase
          .from('leave_request_grant_allocations')
          .select(
            'grant_id, leave_request_id, working_days, leave_requests(status, type, start_date, user_id)'
          )
          .in('grant_id', grantIds)
      : { data: [] };

  const memberUserIds = [...new Set((members ?? []).map((m: any) => m.user_id as string).filter(Boolean))];
  const approvedByUser = await fetchApprovedUsageGloballyForUsers(supabase, memberUserIds);

  const membersForStats = (members || []).map((m: any) => {
    const u = approvedByUser.get(m.user_id as string);
    return {
      annual_leave_total: m.annual_leave_total,
      annual_leave_used: u?.annual ?? Number(m.annual_leave_used ?? 0),
      sick_leave_total: m.sick_leave_total,
      sick_leave_used: u?.sick ?? Number(m.sick_leave_used ?? 0),
      religious_leave_total: m.religious_leave_total,
      religious_leave_used: u?.religious ?? Number(m.religious_leave_used ?? 0),
      users: m.users,
    };
  });

  const memberNamesByUserId = new Map<string, string>();
  for (const member of members || []) {
    const userId = member.user_id as string;
    const name = (member as { users?: { name?: string | null } }).users?.name;
    if (userId && name) {
      memberNamesByUserId.set(userId, name);
    }
  }

  const fundDefinitionOptions = balanceInputs.definitions;
  const defaultFundId = pickDefaultAnnualFundDefinitionId(
    fundDefinitionOptions,
    balanceInputs.grantTotalsForPool,
    { anchorDate: today, policy: balanceInputs.policy }
  );

  const fundStats = buildFundScopedOverviewStats(
    fundDefinitionOptions,
    grants as OverviewGrantRow[],
    (allocations || []) as unknown as OverviewAllocationRow[],
    memberNamesByUserId
  );

  const overviewStats = buildProjectOverviewStats(
    membersForStats,
    metrics,
    mapUpcomingLeaveRequests(upcomingRequests)
  );

  return (
    <ProjectOverviewInsights
      projectSlug={projectSlug}
      stats={overviewStats}
      fundDefinitions={fundDefinitionOptions}
      fundStats={fundStats}
      defaultFundId={defaultFundId}
    />
  );
}
