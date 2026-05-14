import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LeaveRequestsPanel } from '@/components/leave/leave-requests-panel';
import { MemberFundsPanel, type MemberFundAllocationLine, type MemberFundGrant } from '@/components/projects/member-funds-panel';
import { MemberProfileTabs } from '@/components/projects/member-profile-tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetchApprovedUsageGloballyForUser } from '@/lib/leave/approved-usage-from-requests';
import { leaveRequestWithUserSelect } from '@/lib/leave/queries';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { canReviewLeaveForRole } from '@/lib/projects/access';
import { formatRoleLabel } from '@/lib/email/format';
import { projectPath } from '@/lib/projects/paths';
import { getProjectBySlug } from '@/lib/projects/resolve';
import { getInitials } from '@/lib/utils';

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
      'role, annual_leave_total, annual_leave_used, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used, users(id, name, email, avatar_url)'
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

  const [{ data: requests }, approvedUsage, { data: grantRows }, { data: defRows }] = await Promise.all([
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
    supabase.from('project_annual_fund_definitions').select('id, label').eq('project_id', projectId),
  ]);

  const defLabelMap = new Map((defRows || []).map((d) => [d.id as string, d.label as string]));

  const memberFundsGrants: MemberFundGrant[] = (grantRows || []).map((row) => ({
    id: row.id as string,
    label: (row.label as string) || 'Fund',
    grant_year: (row.grant_year as number | null) ?? null,
    valid_from: row.valid_from as string,
    valid_to: (row.valid_to as string | null) ?? null,
    source: row.source as string,
    days_allocated: Number(row.days_allocated ?? 0),
    definition_label: row.definition_id ? defLabelMap.get(row.definition_id as string) ?? null : null,
  }));

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

      <Card>
        <CardContent className="flex flex-wrap items-start gap-5 p-6">
          <Avatar className="h-16 w-16">
            {memberUser.avatar_url ? (
              <AvatarImage src={memberUser.avatar_url} alt={memberUser.name} />
            ) : null}
            <AvatarFallback>{getInitials(memberUser.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono uppercase">
                {formatRoleLabel(membership.role)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{memberUser.email}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Annual</p>
                <p className="mt-1 font-mono text-lg tabular-nums">
                  {approvedUsage.annual} / {membership.annual_leave_total}
                </p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sick</p>
                <p className="mt-1 font-mono text-lg tabular-nums">
                  {approvedUsage.sick} / {membership.sick_leave_total}
                </p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Religious</p>
                <p className="mt-1 font-mono text-lg tabular-nums">
                  {approvedUsage.religious} / {membership.religious_leave_total}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              &quot;Used&quot; sums approved days from every project you belong to; the allowance shown is
              this team&apos;s allocation.
            </p>
          </div>
        </CardContent>
      </Card>

      <MemberProfileTabs
        leaveLabel="Leave history"
        fundsLabel="Annual funds"
        leaveContent={
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl">Leave history</h2>
              <Button asChild variant="outline" size="sm">
                <Link href={projectPath(project.slug, 'calendar')}>Open team calendar</Link>
              </Button>
            </div>
            <LeaveRequestsPanel
              requests={requests || []}
              canReview={canReview}
              projectSlug={project.slug}
              currentUserId={user.id}
            />
          </div>
        }
        fundsContent={
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-xl">Annual funds</h2>
              <Button asChild variant="outline" size="sm">
                <Link href={projectPath(project.slug, 'requests', 'new')}>New leave request</Link>
              </Button>
            </div>
            <MemberFundsPanel
              projectSlug={project.slug}
              grants={memberFundsGrants}
              allocationLines={memberFundAllocationLines}
            />
          </div>
        }
      />
    </div>
  );
}
