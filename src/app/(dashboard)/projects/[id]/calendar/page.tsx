import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { TeamScheduler } from '@/components/calendar/team-scheduler';
import { Button } from '@/components/ui/button';
import { mapHolidayToEvent, mapLeaveRequestToEvent } from '@/lib/calendar/map-events';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import { canReviewLeave, getCurrentUser } from '@/lib/projects/access';

export default async function ProjectCalendarPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect('/login');

  const { data: project } = await supabase.from('projects').select('id, name').eq('id', params.id).maybeSingle();
  if (!project) notFound();

  const { data: membership } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) notFound();

  const [{ data: requests }, { data: members }, { data: holidays }] = await Promise.all([
    supabase
      .from('leave_requests')
      .select(`id, user_id, type, status, start_date, end_date, ${leaveRequestUserEmbed}(name, avatar_url)`)
      .eq('project_id', params.id)
      .in('status', ['pending', 'approved']),
    supabase
      .from('project_members')
      .select('users(id, name)')
      .eq('project_id', params.id),
    supabase.from('national_holidays').select('id, name, date').order('date', { ascending: true }),
  ]);

  const schedulerMembers = (members || [])
    .map((member: { users?: { id: string; name: string } | { id: string; name: string }[] | null }) =>
      Array.isArray(member.users) ? member.users[0] : member.users
    )
    .filter((member): member is { id: string; name: string } => Boolean(member?.id && member?.name))
    .map((member) => ({ id: member.id, name: member.name }));

  const events = [
    ...(requests || []).map((request) => mapLeaveRequestToEvent(request)),
    ...(holidays || []).map((holiday) => mapHolidayToEvent(holiday)),
  ];

  const canReview = await canReviewLeave(params.id, user.id);

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${params.id}`} aria-label="Back to project">
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
            <Link href={`/projects/${params.id}/requests`}>Leave requests</Link>
          </Button>
          <Button asChild>
            <Link href={`/projects/${params.id}/requests/new`}>
              <Plus className="h-4 w-4" />
              Request leave
            </Link>
          </Button>
        </div>
      </div>

      <TeamScheduler
        events={events}
        members={schedulerMembers}
        canReview={canReview}
        projectId={params.id}
      />
    </div>
  );
}
