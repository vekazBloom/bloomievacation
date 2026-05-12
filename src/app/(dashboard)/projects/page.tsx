import Link from 'next/link';
import { CheckCircle2, Plus, Users, FolderKanban } from 'lucide-react';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { RemoteImage } from '@/components/ui/remote-image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { canReviewLeaveForRole } from '@/lib/projects/access';
import { projectPath } from '@/lib/projects/paths';

export default async function ProjectsPage() {
  const session = await getDashboardSession();
  if (!session) return null;

  const { supabase, user, profile } = session;

  const { data: memberships } = await supabase
    .from('project_members')
    .select('role, projects(id, slug, name, description, logo_url, is_archived, created_at)')
    .eq('user_id', user.id);

  const projects =
    (memberships || [])
      .filter((m: any) => m.projects && !m.projects.is_archived)
      .map((m: any) => ({
        ...m.projects,
        role: m.role,
        canReview: canReviewLeaveForRole(profile?.is_system_admin, m.role),
      })) || [];

  const projectIds = projects.map((p: any) => p.id);
  const memberCounts: Record<string, number> = {};
  const pendingCounts: Record<string, number> = {};

  if (projectIds.length > 0) {
    const [{ data: counts }, { data: pendingRequests }] = await Promise.all([
      supabase.from('project_members').select('project_id').in('project_id', projectIds),
      supabase
        .from('leave_requests')
        .select('project_id')
        .in('project_id', projectIds)
        .eq('status', 'pending'),
    ]);

    (counts || []).forEach((c: any) => {
      memberCounts[c.project_id] = (memberCounts[c.project_id] || 0) + 1;
    });

    (pendingRequests || []).forEach((request: any) => {
      pendingCounts[request.project_id] = (pendingCounts[request.project_id] || 0) + 1;
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-fade-in">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each project has its own team, leave balances, and policies.
          </p>
        </div>
        {profile?.is_system_admin && (
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              New project
            </Link>
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-lg">No projects yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                {profile?.is_system_admin
                  ? 'Create your first project to start tracking time off.'
                  : "You haven't been added to any project yet. Ask an admin to invite you."}
              </p>
            </div>
            {profile?.is_system_admin && (
              <Button asChild className="mt-2">
                <Link href="/projects/new">
                  <Plus className="h-4 w-4" />
                  Create project
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p: any) => {
            const pendingCount = pendingCounts[p.id] || 0;

            return (
              <div
                key={p.id}
                className="flex flex-col rounded-lg border border-border bg-card transition-all hover:border-primary/30 hover:shadow-md"
              >
                <Link href={projectPath(p.slug)} className="group block flex-1 p-5">
                  <div className="flex items-start gap-3">
                    {p.logo_url ? (
                      <RemoteImage
                        src={p.logo_url}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-xl text-primary">
                        {p.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-lg font-medium leading-tight transition-colors group-hover:text-primary">
                        {p.name}
                      </h3>
                      {p.role !== 'employee' && (
                        <Badge variant="secondary" className="mt-1 font-mono uppercase">
                          {p.role}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {p.description && (
                    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                  )}
                  <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {memberCounts[p.id] || 0} member{memberCounts[p.id] === 1 ? '' : 's'}
                    </span>
                    {p.canReview && pendingCount > 0 ? (
                      <Badge variant="outline">{pendingCount} pending</Badge>
                    ) : null}
                  </div>
                </Link>

                {p.canReview ? (
                  <div className="border-t border-border px-5 py-4">
                    <Button asChild className="w-full" variant={pendingCount > 0 ? 'default' : 'outline'}>
                      <Link href={projectPath(p.slug, 'requests')}>
                        <CheckCircle2 className="h-4 w-4" />
                        Approve requests
                        {pendingCount > 0 ? ` (${pendingCount})` : ''}
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
