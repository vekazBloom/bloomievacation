import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LeaveRequestsPanel } from '@/components/leave/leave-requests-panel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { leaveRequestWithUserSelect } from '@/lib/leave/queries';
import { canReviewLeave, getCurrentUser } from '@/lib/projects/access';
import { formatRoleLabel } from '@/lib/email/format';
import { getInitials } from '@/lib/utils';

export default async function ProjectMemberProfilePage({
  params,
}: {
  params: { id: string; userId: string };
}) {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: project } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', params.id)
    .maybeSingle();
  if (!project) notFound();

  const { data: viewerMembership } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!viewerMembership) notFound();

  const { data: membership } = await supabase
    .from('project_members')
    .select(
      'role, annual_leave_total, annual_leave_used, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used, users(id, name, email, avatar_url)'
    )
    .eq('project_id', params.id)
    .eq('user_id', params.userId)
    .maybeSingle();
  if (!membership) notFound();

  const memberUser = (
    membership as unknown as {
      users?: { id: string; name: string; email: string; avatar_url?: string | null } | null;
    }
  ).users;
  if (!memberUser) notFound();

  const { data: requests } = await supabase
    .from('leave_requests')
    .select(leaveRequestWithUserSelect)
    .eq('project_id', params.id)
    .eq('user_id', params.userId)
    .order('created_at', { ascending: false });

  const canReview = await canReviewLeave(params.id, user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${params.id}`} aria-label="Back to project">
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
                  {membership.annual_leave_used} / {membership.annual_leave_total}
                </p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sick</p>
                <p className="mt-1 font-mono text-lg tabular-nums">
                  {membership.sick_leave_used} / {membership.sick_leave_total}
                </p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Religious</p>
                <p className="mt-1 font-mono text-lg tabular-nums">
                  {membership.religious_leave_used} / {membership.religious_leave_total}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">Leave history</h2>
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${params.id}/calendar`}>Open team calendar</Link>
          </Button>
        </div>
        <LeaveRequestsPanel
          requests={requests || []}
          canReview={canReview}
          projectId={params.id}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}
