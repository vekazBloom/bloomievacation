import { endOfWeek, format, startOfWeek } from 'date-fns';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { LeaveStatus, LeaveType } from '@/types/database';
import { assertProjectMember, getReviewableProjectIds } from '@/lib/bot/permissions';

export type TeamLeaveRow = {
  name: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
};

async function getProjectMemberUserIds(supabase: AppSupabase, projectId: string) {
  const { data } = await supabase
    .from('project_members')
    .select('user_id')
    .eq('project_id', projectId);
  return [...new Set((data || []).map((row) => row.user_id).filter(Boolean))] as string[];
}

function mapLeaveRows(
  rows: Array<{
    type: LeaveType;
    start_date: string;
    end_date: string;
    status: LeaveStatus;
    users: { name: string } | { name: string }[] | null;
  }>
): TeamLeaveRow[] {
  return rows.map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      name: user?.name ?? 'Zaposlenik',
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
    };
  });
}

export async function getTeamOnLeave(
  supabase: AppSupabase,
  userId: string,
  projectId: string,
  startDate: string,
  endDate: string,
  options?: { includePending?: boolean; types?: LeaveType[] }
) {
  const access = await assertProjectMember(supabase, userId, projectId);
  if (!access.ok) return access;

  const memberIds = await getProjectMemberUserIds(supabase, projectId);
  if (memberIds.length === 0) return { ok: true as const, entries: [] as TeamLeaveRow[] };

  const statuses: LeaveStatus[] = options?.includePending
    ? ['approved', 'pending']
    : ['approved'];

  let query = supabase
    .from('leave_requests')
    .select(`type, start_date, end_date, status, ${leaveRequestUserEmbed}(name)`)
    .in('user_id', memberIds)
    .in('status', statuses)
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .order('start_date', { ascending: true });

  if (options?.types?.length) {
    query = query.in('type', options.types);
  }

  const { data, error } = await query;
  if (error) return { ok: false as const, error: error.message, status: 500 };

  return { ok: true as const, entries: mapLeaveRows((data || []) as Parameters<typeof mapLeaveRows>[0]) };
}

export async function getTeamOnLeaveToday(supabase: AppSupabase, userId: string, projectId: string) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return getTeamOnLeave(supabase, userId, projectId, today, today);
}

export async function getTeamOnLeaveThisWeek(supabase: AppSupabase, userId: string, projectId: string) {
  const now = new Date();
  const start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const end = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return getTeamOnLeave(supabase, userId, projectId, start, end);
}

export async function getVacationOverlap(
  supabase: AppSupabase,
  userId: string,
  projectId: string,
  startDate: string,
  endDate: string
) {
  const access = await assertProjectMember(supabase, userId, projectId);
  if (!access.ok) return access;

  const { data: overlapRows, error } = await supabase.rpc('check_vacation_overlap', {
    p_project_id: projectId,
    p_start: startDate,
    p_end: endDate,
    p_exclude_request_id: undefined,
  });

  if (error) return { ok: false as const, error: error.message, status: 500 };

  const overlap = overlapRows?.[0];
  const totalMembers = overlap?.total_members ?? 0;
  const overlappingMembers = overlap?.overlapping_members ?? 0;
  const thresholdPercent = overlap?.threshold_percent ?? 50;
  const overlapPercent =
    totalMembers > 0 ? Math.round((overlappingMembers / totalMembers) * 100) : 0;

  return {
    ok: true as const,
    totalMembers,
    overlappingMembers,
    thresholdPercent,
    overlapPercent,
    exceedsThreshold: overlapPercent >= thresholdPercent,
  };
}

export async function listPendingTeamRequests(
  supabase: AppSupabase,
  reviewerId: string,
  options?: { projectId?: string; limit?: number }
) {
  let projectIds = await getReviewableProjectIds(supabase, reviewerId);
  if (projectIds.length === 0) {
    return { ok: false as const, error: 'Nemate dozvolu za pregled pending zahtjeva.', status: 403 };
  }

  if (options?.projectId) {
    if (!projectIds.includes(options.projectId)) {
      return { ok: false as const, error: 'Nemate dozvolu u ovom projektu.', status: 403 };
    }
    projectIds = [options.projectId];
  }

  const limit = options?.limit ?? 10;
  const { data, error } = await supabase
    .from('leave_requests')
    .select(
      `id, type, start_date, end_date, working_days_count, status, project_id, ${leaveRequestUserEmbed}(name), projects!leave_requests_project_id_fkey(name)`
    )
    .in('project_id', projectIds)
    .eq('status', 'pending')
    .neq('user_id', reviewerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { ok: false as const, error: error.message, status: 500 };

  return {
    ok: true as const,
    requests: (data || []).map((row) => ({
      requestId: row.id,
      employeeName: (Array.isArray(row.users) ? row.users[0] : row.users)?.name ?? 'Zaposlenik',
      projectName: (Array.isArray(row.projects) ? row.projects[0] : row.projects)?.name ?? 'Projekat',
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      workingDays: row.working_days_count,
    })),
  };
}
