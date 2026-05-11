import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { TeamScheduler } from '@/components/calendar/team-scheduler';
import { LeaveRequestForm } from '@/components/leave/leave-request-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { mapHolidayToEvent, mapLeaveRequestToEvent } from '@/lib/calendar/map-events';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import { getCurrentUser } from '@/lib/projects/access';

export default async function NewLeaveRequestPage({ params }: { params: { id: string } }) {
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${params.id}/requests`} aria-label="Back to requests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Request leave</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardContent className="p-6">
            <LeaveRequestForm projectId={params.id} />
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div>
            <h2 className="font-display text-xl">Team availability</h2>
            <p className="text-sm text-muted-foreground">
              See who is already away before you submit your request.
            </p>
          </div>
          <TeamScheduler events={events} members={schedulerMembers} projectId={params.id} />
        </div>
      </div>
    </div>
  );
}
