import { assertProjectMember } from '@/lib/projects/membership';
import { getNationalHolidays } from '@/lib/holidays/national';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { LeaveStatus, LeaveType } from '@/types/database';

export type CalendarLeaveRow = {
  id: string;
  userId: string;
  projectId: string | null;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  reason: string | null;
  employeeName: string;
  projectName: string | null;
};

export async function getPersonalCalendarData(supabase: AppSupabase, userId: string) {
  const [{ data: requests }, holidays] = await Promise.all([
    supabase
      .from('leave_requests')
      .select(
        `id, user_id, project_id, type, status, start_date, end_date, reason, projects!leave_requests_project_id_fkey(name), ${leaveRequestUserEmbed}(name)`
      )
      .eq('user_id', userId)
      .in('status', ['pending', 'approved']),
    getNationalHolidays(),
  ]);

  const leaveRequests: CalendarLeaveRow[] = (requests || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    type: row.type,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    employeeName: (Array.isArray(row.users) ? row.users[0] : row.users)?.name ?? 'Korisnik',
    projectName: (Array.isArray(row.projects) ? row.projects[0] : row.projects)?.name ?? null,
  }));

  return { ok: true as const, leaveRequests, holidays: holidays || [] };
}

export async function getProjectTeamCalendarData(
  supabase: AppSupabase,
  userId: string,
  projectId: string
) {
  const access = await assertProjectMember(supabase, userId, projectId);
  if (!access.ok) return access;

  const [{ data: members }, holidays] = await Promise.all([
    supabase.from('project_members').select('user_id').eq('project_id', projectId),
    getNationalHolidays(),
  ]);

  const memberUserIds = [
    ...new Set((members || []).map((row) => row.user_id).filter(Boolean)),
  ] as string[];

  if (memberUserIds.length === 0) {
    return { ok: true as const, leaveRequests: [] as CalendarLeaveRow[], holidays: holidays || [] };
  }

  const { data: requests, error } = await supabase
    .from('leave_requests')
    .select(
      `id, user_id, project_id, type, status, start_date, end_date, reason, ${leaveRequestUserEmbed}(name), projects!leave_requests_project_id_fkey(name)`
    )
    .in('user_id', memberUserIds)
    .in('status', ['pending', 'approved']);

  if (error) return { ok: false as const, error: error.message, status: 500 };

  const leaveRequests: CalendarLeaveRow[] = (requests || []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    type: row.type,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    employeeName: (Array.isArray(row.users) ? row.users[0] : row.users)?.name ?? 'Zaposlenik',
    projectName: (Array.isArray(row.projects) ? row.projects[0] : row.projects)?.name ?? null,
  }));

  return { ok: true as const, leaveRequests, holidays: holidays || [] };
}
