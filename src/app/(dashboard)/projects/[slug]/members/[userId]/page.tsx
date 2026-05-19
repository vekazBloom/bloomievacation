import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { MemberProfileCardWithTabs } from '@/components/projects/member-profile-card-with-tabs';
import type { MemberFundAllocationLine, MemberFundGrant } from '@/components/projects/member-funds-panel';
import { Button } from '@/components/ui/button';
import { fetchApprovedUsageGloballyForUser } from '@/lib/leave/approved-usage-from-requests';
import { leaveRequestWithUserSelect } from '@/lib/leave/queries';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { canManageProject, canReviewLeaveForRole } from '@/lib/projects/access';
import { formatRoleLabel } from '@/lib/email/format';
import { projectPath } from '@/lib/projects/paths';
import { getProjectBySlug } from '@/lib/projects/resolve';

export const dynamic = 'force-dynamic';

export default async function ProjectMemberProfilePage({
  params,
}: {
  params: { slug: string; userId: string };
}) {
  const session = await getDashboardSession();
  if (!session) redirect('/login');

  const { supabase, user, profile } = session;

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) notFound();

  const projectId = project.id;

  const { data: viewerMembership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!viewerMembership) notFound();

  const { data: membership } = await supabase
    .from('project_members')
    .select(
      'role, annual_leave_total, annual_leave_carried_over, annual_leave_used, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used, users(id, name, email, avatar_url)'
    )
    .eq('project_id', projectId)
    .eq('user_id', params.userId)
    .maybeSingle();
  if (!membership) notFound();

  const memberUser = (
    membership as unknown as {
      users?: { id: string; name: string; email: string; avatar_url?: string | null } | null;
    }
  ).users;
  if (!memberUser) notFound();

  const [
    { data: requests },
    approvedUsage,
    { data: grantRows },
    { data: defRows },
    { data: projectApprovedRows },
    { data: templateAssignRows },
  ] = await Promise.all([
    supabase
      .from('leave_requests')
      .select(leaveRequestWithUserSelect)
      .eq('project_id', projectId)
      .eq('user_id', params.userId)
      .order('created_at', { ascending: false }),
    fetchApprovedUsageGloballyForUser(supabase, params.userId),
    supabase
      .from('annual_entitlement_grants')
      .select('id, label, grant_year, days_allocated, valid_from, valid_to, source, definition_id')
      .eq('project_id', projectId)
      .eq('user_id', params.userId)
      .order('valid_from', { ascending: true }),
    supabase
      .from('annual_fund_definitions')
      .select('id, label')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true }),
    supabase
      .from('leave_requests')
      .select('type, working_days_count')
      .eq('project_id', projectId)
      .eq('user_id', params.userId)
      .eq('status', 'approved'),
    supabase
      .from('user_annual_fund_definition_assignments')
      .select('definition_id')
      .eq('user_id', params.userId),
  ]);

  const approvedInProject = { annual: 0, sick: 0, religious: 0 };
  for (const r of projectApprovedRows || []) {
    const t = r.type as string;
    const d = Number(r.working_days_count ?? 0);
    if (!Number.isFinite(d)) continue;
    if (t === 'annual') approvedInProject.annual += d;
    else if (t === 'sick') approvedInProject.sick += d;
    else if (t === 'religious') approvedInProject.religious += d;
  }

  const fromAssignments = (templateAssignRows || []).map((r) => r.definition_id as string);
  const legacyGrantRow = (grantRows || []).find((r) => (r as { source: string }).source === 'legacy_migration');
  const legacyDefId = (legacyGrantRow as { definition_id?: string | null } | undefined)?.definition_id ?? null;
  const assignedTemplateIds =
    fromAssignments.length > 0 ? fromAssignments : legacyDefId ? [legacyDefId] : [];

  const defLabelMap = new Map((defRows || []).map((d) => [d.id as string, d.label as string]));

  const memberFundsGrants: MemberFundGrant[] = (grantRows || []).map((row) => {
    const defId = (row.definition_id as string | null) ?? null;
    return {
      id: row.id as string,
      label: (row.label as string) || 'Fund',
      grant_year: (row.grant_year as number | null) ?? null,
      valid_from: row.valid_from as string,
      valid_to: (row.valid_to as string | null) ?? null,
      source: row.source as string,
      days_allocated: Number(row.days_allocated ?? 0),
      definition_id: defId,
      definition_label: defId ? defLabelMap.get(defId) ?? null : null,
    };
  });

  const grantIds = memberFundsGrants.map((g) => g.id);
  let memberFundAllocationLines: MemberFundAllocationLine[] = [];

  if (grantIds.length > 0) {
    const { data: allocRows } = await supabase
      .from('leave_request_grant_allocations')
      .select('grant_id, working_days, leave_request_id')
      .in('grant_id', grantIds);

    const reqIds = [...new Set((allocRows || []).map((a) => a.leave_request_id as string).filter(Boolean))];
    if (reqIds.length > 0) {
      const { data: reqRows } = await supabase
        .from('leave_requests')
        .select('id, status, start_date, end_date, created_at, user_id, project_id, type')
        .in('id', reqIds)
        .eq('project_id', projectId)
        .eq('user_id', params.userId)
        .eq('type', 'annual');

      const reqById = new Map((reqRows || []).map((r) => [r.id as string, r]));

      memberFundAllocationLines = (allocRows || [])
        .map((a) => {
          const lr = reqById.get(a.leave_request_id as string);
          if (!lr) return null;
          return {
            grant_id: a.grant_id as string,
            working_days: Number(a.working_days ?? 0),
            request_id: lr.id as string,
            status: lr.status as string,
            start_date: lr.start_date as string,
            end_date: lr.end_date as string,
            created_at: lr.created_at as string,
          };
        })
        .filter((x): x is MemberFundAllocationLine => x != null);
    }
  }

  const canReview = canReviewLeaveForRole(profile.is_system_admin, viewerMembership.role);
  const canManage = await canManageProject(projectId, user.id);
  const fundDefinitionOptions = (defRows || []).map((d) => ({
    id: d.id as string,
    label: d.label as string,
  }));

  const carried = Number(
    (membership as { annual_leave_carried_over?: number | null }).annual_leave_carried_over ?? 0
  );
  const annualProjectPool =
    Number((membership as { annual_leave_total?: number | null }).annual_leave_total ?? 0) + carried;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={projectPath(project.slug)} aria-label="Back to project">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">{memberUser.name}</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <MemberProfileCardWithTabs
        projectSlug={project.slug}
        memberName={memberUser.name}
        memberEmail={memberUser.email}
        avatarUrl={memberUser.avatar_url ?? null}
        roleLabel={formatRoleLabel(membership.role)}
        annualGlobalApproved={approvedUsage.annual}
        annualProjectPool={annualProjectPool}
        sickGlobalApproved={approvedUsage.sick}
        sickProjectTotal={Number(membership.sick_leave_total ?? 0)}
        religiousGlobalApproved={approvedUsage.religious}
        religiousProjectTotal={Number(membership.religious_leave_total ?? 0)}
        sickProjectApproved={approvedInProject.sick}
        religiousProjectApproved={approvedInProject.religious}
        grants={memberFundsGrants}
        assignedTemplateIds={assignedTemplateIds}
        allocationLines={memberFundAllocationLines}
        requests={requests || []}
        canReview={canReview}
        canManage={canManage}
        fundDefinitions={fundDefinitionOptions}
        currentUserId={user.id}
      />
    </div>
  );
}
