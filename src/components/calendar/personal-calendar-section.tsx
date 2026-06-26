import { TeamSchedulerLazy as TeamScheduler } from '@/components/calendar/team-scheduler-lazy';
import { mapHolidayToEvent, mapLeaveRequestToEvent } from '@/lib/calendar/map-events';
import { getPersonalCalendarData } from '@/lib/read/calendar';
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
  const calendarData = await getPersonalCalendarData(supabase, user.id);
  if (!calendarData.ok) {
    return null;
  }

  const typedRequests = calendarData.leaveRequests.map((row) => ({
    id: row.id,
    user_id: row.userId,
    type: row.type,
    status: row.status,
    start_date: row.startDate,
    end_date: row.endDate,
    reason: row.reason,
    projects: row.projectName ? { name: row.projectName } : null,
    users: { name: row.employeeName },
  })) as RequestRow[];

  const holidays = calendarData.holidays;
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
    if (projectNames.size <= 1) {
      return mapLeaveRequestToEvent(request);
    }
    return mapLeaveRequestToEvent(request, {
      subtitle: `${request.type} · ${request.status || 'approved'}`,
    });
  });

  const events = [
    ...nonReligious.map((request) => mapLeaveRequestToEvent(request)),
    ...mergedReligious,
    ...(holidays || []).map((holiday) => mapHolidayToEvent(holiday)),
  ];

  return <TeamScheduler events={events} showMemberFilters={false} />;
}
