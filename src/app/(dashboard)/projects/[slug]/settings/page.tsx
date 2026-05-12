import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ProjectSettingsForm } from '@/components/projects/project-settings-form';
import { Button } from '@/components/ui/button';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import { projectPath } from '@/lib/projects/paths';
import { getProjectBySlug } from '@/lib/projects/resolve';

export default async function ProjectSettingsPage({ params }: { params: { slug: string } }) {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect('/login');

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) notFound();

  const allowed = await canManageProject(project.id, user.id);
  if (!allowed) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={projectPath(project.slug)} aria-label="Back to project">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Project settings</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <ProjectSettingsForm project={project} />
    </div>
  );
}
