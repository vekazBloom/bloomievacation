import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { LeaveRequestsPanel } from '@/components/leave/leave-requests-panel';
import { Button } from '@/components/ui/button';
import { leaveRequestWithUserSelect } from '@/lib/leave/queries';
import { canReviewLeave, getCurrentUser } from '@/lib/projects/access';

export default async function ProjectRequestsPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: project } = await supabase.from('projects').select('id, name').eq('id', params.id).maybeSingle();
  if (!project) notFound();

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) notFound();

  const { data: requests, error: requestsError } = await supabase
    .from('leave_requests')
    .select(leaveRequestWithUserSelect)
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });

  if (requestsError) {
    console.error('Failed to load leave requests', requestsError);
  }

  const canReview = await canReviewLeave(params.id, user.id);

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${params.id}`} aria-label="Back to project">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight">Leave requests</h1>
            <p className="text-sm text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/projects/${params.id}/requests/new`}>
            <Plus className="h-4 w-4" />
            New request
          </Link>
        </Button>
      </div>

      <LeaveRequestsPanel
        requests={requests || []}
        canReview={canReview}
        projectId={params.id}
        currentUserId={user.id}
      />
    </div>
  );
}
