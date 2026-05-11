import type { SchedulerEvent } from '@/components/calendar/team-scheduler';

type UserEmbed = { name?: string | null; avatar_url?: string | null };
type ProjectEmbed = { name?: string | null };

type LeaveRequestRow = {
  id: string;
  user_id?: string;
  type: SchedulerEvent['type'];
  status?: SchedulerEvent['status'];
  start_date: string;
  end_date: string;
  users?: UserEmbed | UserEmbed[] | null;
  projects?: ProjectEmbed | ProjectEmbed[] | null;
};

function firstEmbed<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type HolidayRow = {
  id: string;
  name: string;
  date: string;
};

export function mapLeaveRequestToEvent(
  request: LeaveRequestRow,
  options?: { title?: string; subtitle?: string }
): SchedulerEvent {
  const user = firstEmbed(request.users);
  const project = firstEmbed(request.projects);

  return {
    id: request.id,
    title: options?.title || user?.name || 'Team member',
    subtitle:
      options?.subtitle ||
      `${project?.name || 'Project'} · ${request.type} · ${request.status || 'approved'}`,
    startDate: request.start_date,
    endDate: request.end_date,
    type: request.type,
    status: request.status,
    userId: request.user_id,
    avatarUrl: user?.avatar_url || undefined,
  };
}

export function mapHolidayToEvent(holiday: HolidayRow): SchedulerEvent {
  return {
    id: `holiday-${holiday.id}`,
    title: holiday.name,
    subtitle: 'National holiday',
    startDate: holiday.date,
    endDate: holiday.date,
    type: 'national',
  };
}
