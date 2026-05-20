import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';
import { LeaveRequestsPanel } from '@/components/leave/leave-requests-panel';
import { ProjectOverviewInsightsFallback } from '@/components/projects/project-overview-insights-fallback';
import { ProjectOverviewInsightsSection } from '@/components/projects/project-overview-insights-section';
import { ProjectTeamMembersSection } from '@/components/projects/project-team-members-section';
import { leaveRequestWithUserSelect } from '@/lib/leave/queries';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { canReviewLeaveForRole } from '@/lib/projects/access';
import { projectPath } from '@/lib/projects/paths';
import { getProjectBySlug } from '@/lib/projects/resolve';
import { formatPolicyDate, milestoneForMonthDay } from '@/lib/leave/annual-policy-dates';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, ClipboardList, Settings, Users, Send } from 'lucide-react';
import { RemoteImage } from '@/components/ui/remote-image';

export default async function ProjectPage({ params }: { params: { slug: string } }) {
  const session = await getDashboardSession();
  if (!session) return null;

  const { supabase, user, profile } = session;

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) notFound();

  const projectId = project.id;

  const { data: myMembership } = await supabase
    .from('project_members')
    .select('role, annual_leave_total, annual_leave_used, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!myMembership) notFound();

  const isAdmin = myMembership.role === 'admin';
  const canReview = canReviewLeaveForRole(profile.is_system_admin, myMembership.role);

  const [{ data: pendingRequests }] = await Promise.all([
    canReview
      ? supabase
          .from('leave_requests')
          .select(leaveRequestWithUserSelect)
          .eq('project_id', projectId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const pendingCount = pendingRequests?.length || 0;

  const policyFrom = new Date();
  const nextPolicyReset = milestoneForMonthDay(
    Number(project.year_reset_month ?? 1),
    Number(project.year_reset_day ?? 1),
    policyFrom
  );
  const nextPolicyAccrual = milestoneForMonthDay(
    Number(project.annual_accrual_month ?? 1),
    Number(project.annual_accrual_day ?? 1),
    policyFrom
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      {/* Header */}
      <Card>
        <CardContent className="flex items-start gap-5 p-6">
          {project.logo_url ? (
            <RemoteImage
              src={project.logo_url}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-2xl text-primary">
              {project.name[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-medium tracking-tight">
                {project.name}
              </h1>
              <Badge variant="outline" className="font-mono uppercase">
                {myMembership.role}
              </Badge>
            </div>
            {project.description && (
              <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Threshold: {project.vacation_threshold_percent}%</span>
              <span>
                Year reset: {project.year_reset_month}/{project.year_reset_day}
              </span>
              <span>
                Annual accrual: {project.annual_accrual_month ?? 1}/{project.annual_accrual_day ?? 1}
              </span>
              <span>Carry-over: {(project.carry_over_policy ?? 'ask').replace('_', ' ')}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/85">
              <span>
                Next year reset:{' '}
                <span className="font-medium">{formatPolicyDate(nextPolicyReset.date)}</span>
                {nextPolicyReset.daysUntil === 0
                  ? ' (today)'
                  : ` (in ${nextPolicyReset.daysUntil} day${nextPolicyReset.daysUntil === 1 ? '' : 's'})`}
              </span>
              <span>
                Next accrual date:{' '}
                <span className="font-medium">{formatPolicyDate(nextPolicyAccrual.date)}</span>
                {nextPolicyAccrual.daysUntil === 0
                  ? ' (today)'
                  : ` (in ${nextPolicyAccrual.daysUntil} day${nextPolicyAccrual.daysUntil === 1 ? '' : 's'})`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href={projectPath(project.slug, 'calendar')}>
            <CalendarDays className="h-4 w-4" />
            Team calendar
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={projectPath(project.slug, 'requests', 'new')}>
            <Send className="h-4 w-4" />
            Request leave
          </Link>
        </Button>
        {canReview ? (
          <Button asChild variant={pendingCount > 0 ? 'default' : 'outline'}>
            <Link href={projectPath(project.slug, 'requests')}>
              <ClipboardList className="h-4 w-4" />
              Approve requests
              {pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Link>
          </Button>
        ) : null}
        {isAdmin && (
          <>
            <Button variant="outline" asChild>
              <Link href={projectPath(project.slug, 'members')}>
                <Users className="h-4 w-4" />
                Manage members
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={projectPath(project.slug, 'settings')}>
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </Button>
          </>
        )}
      </div>

      <Suspense fallback={<ProjectOverviewInsightsFallback />}>
        <ProjectOverviewInsightsSection projectId={projectId} projectSlug={project.slug} />
      </Suspense>

      {canReview && pendingCount > 0 ? (
        <Card>
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-display text-lg">Pending leave requests</h2>
            <p className="text-sm text-muted-foreground">
              Approve or reject requests waiting for your review.
            </p>
          </div>
          <CardContent className="p-0">
            <LeaveRequestsPanel
              requests={pendingRequests || []}
              canReview={canReview}
              projectSlug={project.slug}
              currentUserId={user.id}
            />
          </CardContent>
        </Card>
      ) : null}

      <Suspense
        fallback={
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Loading team members…</CardContent>
          </Card>
        }
      >
        <ProjectTeamMembersSection projectId={projectId} projectSlug={project.slug} isAdmin={isAdmin} />
      </Suspense>

    </div>
  );
}
