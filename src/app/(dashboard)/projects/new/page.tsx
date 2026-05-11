import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NewProjectForm } from '@/components/projects/new-project-form';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function NewProjectPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('is_system_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.is_system_admin) {
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
