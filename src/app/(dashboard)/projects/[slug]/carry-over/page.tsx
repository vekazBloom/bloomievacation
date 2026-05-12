import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { CarryOverPanel } from '@/components/projects/carry-over-panel';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/projects/access';
import { projectPath } from '@/lib/projects/paths';
import { getProjectBySlug } from '@/lib/projects/resolve';

export default async function CarryOverPage({ params }: { params: { slug: string } }) {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect('/login');

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) notFound();

  const projectId = project.id;

  const { data: membership } = await supabase
    .from('project_members')
    .select('annual_leave_total, annual_leave_used, annual_leave_carried_over')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) notFound();

  const year = new Date().getFullYear();
  const remaining =
    Number(membership.annual_leave_total || 0) +
    Number(membership.annual_leave_carried_over || 0) -
    Number(membership.annual_leave_used || 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={projectPath(project.slug)} aria-label="Back to project">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Carry-over</h1>
          <p className="text-sm text-muted-foreground">Decide what happens to unused annual leave.</p>
        </div>
      </div>

      {remaining > 0 ? (
        <CarryOverPanel projectId={projectId} year={year} remainingDays={remaining} />
      ) : (
        <p className="text-sm text-muted-foreground">No remaining annual days need a carry-over decision.</p>
      )}
    </div>
  );
}
