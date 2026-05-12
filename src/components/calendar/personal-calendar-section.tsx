import { TeamSchedulerLazy as TeamScheduler } from '@/components/calendar/team-scheduler-lazy';
import { mapHolidayToEvent, mapLeaveRequestToEvent } from '@/lib/calendar/map-events';
import { getNationalHolidays } from '@/lib/holidays/national';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import { getDashboardSession } from '@/lib/auth/dashboard';

export async function PersonalCalendarSection() {
  const session = await getDashboardSession();
  if (!session) {
    return null;
  }

  const { supabase, user } = session;
  const [{ data: requests }, holidays] = await Promise.all([
    supabase
      .from('leave_requests')
      .select(`id, user_id, type, status, start_date, end_date, projects(name), ${leaveRequestUserEmbed}(name, avatar_url)`)
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved']),
    getNationalHolidays(),
  ]);

  const events = [
    ...(requests || []).map((request) => mapLeaveRequestToEvent(request)),
    ...(holidays || []).map((holiday) => mapHolidayToEvent(holiday)),
  ];

  return <TeamScheduler events={events} showMemberFilters={false} />;
}
