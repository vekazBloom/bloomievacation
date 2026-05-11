import { redirect } from 'next/navigation';
import { TeamScheduler } from '@/components/calendar/team-scheduler';
import { mapHolidayToEvent, mapLeaveRequestToEvent } from '@/lib/calendar/map-events';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import { getCurrentUser } from '@/lib/projects/access';

export default async function PersonalCalendarPage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect('/login');

  const [{ data: requests }, { data: holidays }] = await Promise.all([
    supabase
      .from('leave_requests')
      .select(`id, user_id, type, status, start_date, end_date, projects(name), ${leaveRequestUserEmbed}(name, avatar_url)`)
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved']),
    supabase.from('national_holidays').select('id, name, date').order('date', { ascending: true }),
  ]);

  const events = [
    ...(requests || []).map((request) => mapLeaveRequestToEvent(request)),
    ...(holidays || []).map((holiday) => mapHolidayToEvent(holiday)),
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">My calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your approved and pending leave across all projects.
        </p>
      </div>

      <TeamScheduler events={events} showMemberFilters={false} />
    </div>
  );
}
