import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { NewProjectForm } from '@/components/projects/new-project-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewProjectPage() {
  const session = await getDashboardSession();
  if (!session) redirect('/login');

  if (!session.profile.is_system_admin) {
    redirect('/projects');
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to projects
      </Link>

      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Create a new project</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A project is a team space with its own members, calendar, and leave policies.
        </p>
      </div>

      <NewProjectForm />
    </div>
  );
}
