import { ProjectTeamMembersTable, type ProjectTeamMemberRow } from '@/components/projects/project-team-members-table';
import { fetchApprovedUsageGloballyForUsers } from '@/lib/leave/approved-usage-from-requests';
import { getDashboardSession } from '@/lib/auth/dashboard';
import {
  buildMemberAnnualBalancesByFund,
  type OverviewAllocationRow,
  type OverviewGrantRow,
} from '@/lib/projects/overview-fund-stats';
import { Card, CardContent } from '@/components/ui/card';

export async function ProjectTeamMembersSection({
  projectId,
  projectSlug,
  isAdmin,
}: {
  projectId: string;
  projectSlug: string;
  isAdmin: boolean;
}) {
  const session = await getDashboardSession();
  if (!session) {
    return null;
  }

  const { supabase } = session;

  const [{ data: members }, { data: fundDefinitions }, { data: grants }] = await Promise.all([
    supabase
      .from('project_members')
      .select(
        'user_id, role, annual_leave_total, annual_leave_used, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used, users(id, name, email, avatar_url)'
      )
      .eq('project_id', projectId),
    supabase
      .from('annual_fund_definitions')
      .select('id, label')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true }),
    supabase
      .from('annual_entitlement_grants')
        .select('id, user_id, definition_id, days_allocated, valid_from, valid_to, grant_year, source')
      .eq('project_id', projectId),
  ]);

  const grantIds = (grants || []).map((grant) => grant.id as string).filter(Boolean);
  const { data: allocations } =
    grantIds.length > 0
      ? await supabase
          .from('leave_request_grant_allocations')
          .select('grant_id, leave_request_id, working_days, leave_requests(status, type, start_date)')
          .in('grant_id', grantIds)
      : { data: [] };

  const memberUserIds = [...new Set((members ?? []).map((member) => member.user_id as string).filter(Boolean))];
  const approvedByUser = await fetchApprovedUsageGloballyForUsers(supabase, memberUserIds);

  const fundDefinitionOptions = (fundDefinitions || []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
  }));

  const fundBalancesByDefinition = buildMemberAnnualBalancesByFund(
    fundDefinitionOptions,
    (grants || []) as OverviewGrantRow[],
    (allocations || []) as unknown as OverviewAllocationRow[]
  );

  const memberRows: ProjectTeamMemberRow[] = (members || []).map((member) => {
    const user = (
      member as unknown as {
        users: { id: string; name: string; email: string; avatar_url?: string | null };
      }
    ).users;
    const usage = approvedByUser.get(member.user_id as string);

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatar_url ?? null,
      role: member.role as string,
      annualUsed: usage?.annual ?? Number(member.annual_leave_used ?? 0),
      annualTotal: Number(member.annual_leave_total ?? 0),
      sickUsed: usage?.sick ?? Number(member.sick_leave_used ?? 0),
      sickTotal: Number(member.sick_leave_total ?? 0),
      religiousUsed: usage?.religious ?? Number(member.religious_leave_used ?? 0),
      religiousTotal: Number(member.religious_leave_total ?? 0),
    };
  });

  return (
    <Card>
      <CardContent className="p-0">
        <ProjectTeamMembersTable
          projectSlug={projectSlug}
          isAdmin={isAdmin}
          members={memberRows}
          fundDefinitions={fundDefinitionOptions}
          fundBalancesByDefinition={fundBalancesByDefinition}
        />
      </CardContent>
    </Card>
  );
}
