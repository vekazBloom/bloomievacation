import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LeaveRequestsPanel } from '@/components/leave/leave-requests-panel';
import { ProjectOverviewInsights } from '@/components/projects/project-overview-insights';
import { leaveRequestWithUserSelect } from '@/lib/leave/queries';
import { canReviewLeave } from '@/lib/projects/access';
import { buildProjectOverviewStats } from '@/lib/projects/overview';
import { createClient } from '@/lib/supabase/server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { CalendarDays, ClipboardList, Settings, Users, Send } from 'lucide-react';
import { getInitials } from '@/lib/utils';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: project } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!project) notFound();

  const { data: myMembership } = await supabase
    .from('project_members')
    .select('role, annual_leave_total, annual_leave_used, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used')
    .eq('project_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!myMembership) notFound();

  const { data: members } = await supabase
    .from('project_members')
    .select('role, annual_leave_total, annual_leave_used, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used, users(id, name, email, avatar_url)')
    .eq('project_id', params.id);

  const isAdmin = myMembership.role === 'admin';
  const canReview = await canReviewLeave(params.id, user.id);

  const { data: pendingRequests } = canReview
    ? await supabase
        .from('leave_requests')
        .select(leaveRequestWithUserSelect)
        .eq('project_id', params.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
    : { data: [] };

  const pendingCount = pendingRequests?.length || 0;

  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndIso = weekEnd.toISOString().split('T')[0];
  const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

  const { data: projectRequests } = await supabase
    .from('leave_requests')
    .select(`${leaveRequestWithUserSelect}, user_id, working_days_count, created_at`)
    .eq('project_id', params.id);

  const overviewStats = buildProjectOverviewStats(
    (members || []) as any[],
    (projectRequests || []) as any[],
    today,
    weekEndIso,
    monthStart
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      {/* Header */}
      <Card>
        <CardContent className="flex items-start gap-5 p-6">
          {project.logo_url ? (
            <img
              src={project.logo_url}
              alt=""
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
              <span>Carry-over: {project.carry_over_policy.replace('_', ' ')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" asChild>
          <Link href={`/projects/${params.id}/calendar`}>
            <CalendarDays className="h-4 w-4" />
            Team calendar
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/projects/${params.id}/requests/new`}>
            <Send className="h-4 w-4" />
            Request leave
          </Link>
        </Button>
        {canReview ? (
          <Button asChild variant={pendingCount > 0 ? 'default' : 'outline'}>
            <Link href={`/projects/${params.id}/requests`}>
              <ClipboardList className="h-4 w-4" />
              Approve requests
              {pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Link>
          </Button>
        ) : null}
        {isAdmin && (
          <>
            <Button variant="outline" asChild>
              <Link href={`/projects/${params.id}/members`}>
                <Users className="h-4 w-4" />
                Manage members
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/projects/${params.id}/settings`}>
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </Button>
          </>
        )}
      </div>

      <ProjectOverviewInsights projectId={params.id} stats={overviewStats} />

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
              projectId={params.id}
              currentUserId={user.id}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Members + balances table */}
      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg">Team members</h2>
          <p className="text-sm text-muted-foreground">
            Leave balances per person. {isAdmin && '(Click a row to edit)'}
          </p>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Annual</th>
                  <th className="px-4 py-3 text-left font-medium">Sick</th>
                  <th className="px-4 py-3 text-left font-medium">Religious</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(members || []).map((m: any) => (
                  <tr key={m.users.id} className="hover:bg-accent/30">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-7 w-7">
                          {m.users.avatar_url && (
                            <AvatarImage src={m.users.avatar_url} alt={m.users.name} />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {getInitials(m.users.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <Link
                            href={`/projects/${params.id}/members/${m.users.id}`}
                            className="truncate font-medium hover:underline"
                          >
                            {m.users.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">{m.users.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="font-mono uppercase">
                        {m.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {m.annual_leave_used} / {m.annual_leave_total}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {m.sick_leave_used} / {m.sick_leave_total}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums">
                      {m.religious_leave_used} / {m.religious_leave_total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
