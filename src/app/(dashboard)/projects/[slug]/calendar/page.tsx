import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { PersonalCalendarFallback } from '@/components/calendar/personal-calendar-fallback';
import { ProjectTeamCalendarSection } from '@/components/calendar/project-team-calendar-section';
import { Button } from '@/components/ui/button';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { projectPath } from '@/lib/projects/paths';
import { getProjectBySlug } from '@/lib/projects/resolve';

export default async function ProjectCalendarPage({ params }: { params: { slug: string } }) {
  const session = await getDashboardSession();
  if (!session) {
    return null;
  }

  const { supabase } = session;
  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={projectPath(project.slug)} aria-label="Back to project">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight">Team calendar</h1>
            <p className="text-sm text-muted-foreground">{project.name}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={projectPath(project.slug, 'requests')}>Leave requests</Link>
          </Button>
          <Button asChild>
            <Link href={projectPath(project.slug, 'requests', 'new')}>
              <Plus className="h-4 w-4" />
              Request leave
            </Link>
          </Button>
        </div>
      </div>

      <Suspense fallback={<PersonalCalendarFallback />}>
        <ProjectTeamCalendarSection slug={params.slug} />
      </Suspense>
    </div>
  );
}
