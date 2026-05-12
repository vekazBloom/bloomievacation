import Link from 'next/link';
import { ArrowRight, CalendarDays, ClipboardList, FolderKanban, Plus, Settings, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { RemoteImage } from '@/components/ui/remote-image';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getInitials } from '@/lib/utils';
import { projectPath } from '@/lib/projects/paths';

export type AdminProjectOverview = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  memberCount: number;
  pendingCount: number;
  awayThisWeekCount: number;
};

type AdminDashboardOverviewProps = {
  profile: {
    name: string;
    email: string;
    avatar_url?: string | null;
  };
  projects: AdminProjectOverview[];
};

export function AdminDashboardOverview({ profile, projects }: AdminDashboardOverviewProps) {
  const totalMembers = projects.reduce((sum, project) => sum + project.memberCount, 0);
  const totalPending = projects.reduce((sum, project) => sum + project.pendingCount, 0);
  const totalAway = projects.reduce((sum, project) => sum + project.awayThisWeekCount, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-card via-card to-primary/5">
        <CardContent className="space-y-6 p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 border border-border">
              {profile.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={profile.name} />
              ) : null}
              <AvatarFallback className="text-base">{getInitials(profile.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                System admin
              </p>
              <h2 className="mt-1 font-display text-2xl font-medium tracking-tight">{profile.name}</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">{profile.email}</p>
              <Badge variant="secondary" className="mt-3 font-mono uppercase">
                System Administrator
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card/80 px-3 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Projects</p>
              <p className="mt-1 font-mono text-2xl tabular-nums">{projects.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 px-3 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Members</p>
              <p className="mt-1 font-mono text-2xl tabular-nums">{totalMembers}</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 px-3 py-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className="mt-1 font-mono text-2xl tabular-nums">{totalPending}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/profile">
                Open profile
                <ArrowRight className="ml-auto h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start">
              <Link href="/admin/holidays">
                Manage holidays
                <ArrowRight className="ml-auto h-4 w-4" />
              </Link>
            </Button>
            <Button asChild className="w-full justify-start">
              <Link href="/projects/new">
                <Plus className="h-4 w-4" />
                New project
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div>
            <h2 className="font-display text-xl">All projects</h2>
            <p className="text-sm text-muted-foreground">
              {totalAway} teammate{totalAway === 1 ? '' : 's'} away this week across active projects.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/projects">View projects page</Link>
          </Button>
        </div>
        <CardContent className="p-6">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-display text-lg">No active projects yet</p>
                <p className="max-w-md text-sm text-muted-foreground">
                  Create the first project to start managing teams and leave.
                </p>
              </div>
              <Button asChild>
                <Link href="/projects/new">
                  <Plus className="h-4 w-4" />
                  Create project
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    {project.logo_url ? (
                      <RemoteImage
                        src={project.logo_url}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-xl text-primary">
                        {project.name[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={projectPath(project.slug)}
                          className="truncate font-display text-lg font-medium leading-tight transition-colors hover:text-primary"
                        >
                          {project.name}
                        </Link>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                      {project.description ? (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">No description yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline" className="gap-1 font-normal">
                      <Users className="h-3 w-3" />
                      {project.memberCount} member{project.memberCount === 1 ? '' : 's'}
                    </Badge>
                    {project.pendingCount > 0 ? (
                      <Badge variant="pending">{project.pendingCount} pending</Badge>
                    ) : (
                      <Badge variant="outline">No pending requests</Badge>
                    )}
                    {project.awayThisWeekCount > 0 ? (
                      <Badge variant="secondary">{project.awayThisWeekCount} away this week</Badge>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link href={projectPath(project.slug, 'calendar')}>
                        <CalendarDays className="h-3.5 w-3.5" />
                        Calendar
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-8">
                      <Link href={projectPath(project.slug, 'requests')}>
                        <ClipboardList className="h-3.5 w-3.5" />
                        Requests
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="h-8">
                      <Link href={projectPath(project.slug, 'settings')}>
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
