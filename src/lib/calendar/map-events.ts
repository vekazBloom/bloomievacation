import type { SchedulerEvent } from '@/components/calendar/team-scheduler';

type UserEmbed = { name?: string | null; avatar_url?: string | null };
type ProjectEmbed = { name?: string | null; slug?: string | null };

type LeaveRequestRow = {
  id: string;
  project_id?: string;
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
  options?: {
    title?: string;
    subtitle?: string;
    viewingProjectId?: string;
    canReviewThisRequest?: boolean;
  }
): SchedulerEvent {
  const user = firstEmbed(request.users);
  const project = firstEmbed(request.projects);

  const sameCalendarProject =
    options?.viewingProjectId && request.project_id && request.project_id === options.viewingProjectId;

  const defaultSubtitle = sameCalendarProject
    ? `${request.type} · ${request.status || 'approved'}`
    : `${project?.name || 'Project'} · ${request.type} · ${request.status || 'approved'}`;

  return {
    id: request.id,
    title: options?.title || user?.name || 'Team member',
    subtitle: options?.subtitle ?? defaultSubtitle,
    startDate: request.start_date,
    endDate: request.end_date,
    type: request.type,
    status: request.status,
    userId: request.user_id,
    avatarUrl: user?.avatar_url || undefined,
    ...(options?.canReviewThisRequest !== undefined
      ? { canReviewThisRequest: options.canReviewThisRequest }
      : {}),
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
