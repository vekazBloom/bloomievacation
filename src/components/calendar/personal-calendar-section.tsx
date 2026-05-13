import { TeamSchedulerLazy as TeamScheduler } from '@/components/calendar/team-scheduler-lazy';
import { mapHolidayToEvent, mapLeaveRequestToEvent } from '@/lib/calendar/map-events';
import { getNationalHolidays } from '@/lib/holidays/national';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import { getDashboardSession } from '@/lib/auth/dashboard';

type RequestRow = {
  id: string;
  user_id?: string;
  type: 'annual' | 'sick' | 'religious';
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  start_date: string;
  end_date: string;
  reason?: string | null;
  projects?: { name?: string | null } | { name?: string | null }[] | null;
  users?: { name?: string | null; avatar_url?: string | null } | { name?: string | null; avatar_url?: string | null }[] | null;
};

function getProjectName(request: RequestRow) {
  const project = Array.isArray(request.projects) ? request.projects[0] : request.projects;
  return project?.name || null;
}

export async function PersonalCalendarSection() {
  const session = await getDashboardSession();
  if (!session) {
    return null;
  }

  const { supabase, user } = session;
  const [{ data: requests }, holidays] = await Promise.all([
    supabase
      .from('leave_requests')
      .select(`id, user_id, type, status, start_date, end_date, reason, projects(name), ${leaveRequestUserEmbed}(name, avatar_url)`)
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved']),
    getNationalHolidays(),
  ]);

  const typedRequests = (requests || []) as RequestRow[];
  const groupedReligious = new Map<string, { request: RequestRow; projectNames: Set<string> }>();
  const nonReligious = typedRequests.filter((request) => request.type !== 'religious');

  for (const request of typedRequests) {
    if (request.type !== 'religious') continue;
    const key = `${request.user_id || 'unknown'}|${request.start_date}|${request.end_date}|${request.status || 'approved'}|${request.reason ?? ''}`;
    const existing = groupedReligious.get(key);
    const projectName = getProjectName(request);
    if (existing) {
      if (projectName) existing.projectNames.add(projectName);
      continue;
    }
    groupedReligious.set(key, {
      request,
      projectNames: new Set(projectName ? [projectName] : []),
    });
  }

  const mergedReligious = Array.from(groupedReligious.values()).map(({ request, projectNames }) => {
    const projectCount = projectNames.size;
    if (projectCount <= 1) {
      return mapLeaveRequestToEvent(request);
    }

    return mapLeaveRequestToEvent(request, {
      subtitle: `${projectCount} projects · ${request.type} · ${request.status || 'approved'}`,
    });
  });

  const events = [
    ...nonReligious.map((request) => mapLeaveRequestToEvent(request)),
    ...mergedReligious,
    ...(holidays || []).map((holiday) => mapHolidayToEvent(holiday)),
  ];

  return <TeamScheduler events={events} showMemberFilters={false} />;
}
