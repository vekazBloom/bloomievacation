import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { LeaveRequestsPanel } from '@/components/leave/leave-requests-panel';
import { Button } from '@/components/ui/button';
import { leaveRequestWithUserSelect } from '@/lib/leave/queries';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { canReviewLeaveForRole } from '@/lib/projects/access';
import { projectPath } from '@/lib/projects/paths';
import { getProjectBySlug } from '@/lib/projects/resolve';

export default async function ProjectRequestsPage({ params }: { params: { slug: string } }) {
  const session = await getDashboardSession();
  if (!session) return null;

  const { supabase, user, profile } = session;

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) notFound();

  const projectId = project.id;

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: requests, error: requestsError } = await supabase
    .from('leave_requests')
    .select(leaveRequestWithUserSelect)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (requestsError) {
    console.error('Failed to load leave requests', requestsError);
  }

  const canReview = canReviewLeaveForRole(profile.is_system_admin, membership.role);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={projectPath(project.slug)} aria-label="Back to project">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight">Leave requests</h1>
            <p className="text-sm text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={projectPath(project.slug, 'requests', 'new')}>
            <Plus className="h-4 w-4" />
            New request
          </Link>
        </Button>
      </div>

      <LeaveRequestsPanel
        requests={requests || []}
        canReview={canReview}
        canEditRequestFunds={Boolean(profile.is_system_admin)}
        projectId={projectId}
        projectSlug={project.slug}
        currentUserId={user.id}
      />
    </div>
  );
}
