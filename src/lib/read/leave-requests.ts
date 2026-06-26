import { getReviewableProjectIds } from '@/lib/projects/membership';
import {
  leaveRequestProjectEmbedWithSlug,
  leaveRequestUserEmbed,
} from '@/lib/leave/queries';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { LeaveStatus, LeaveType } from '@/types/database';

export type MyLeaveRequestRow = {
  id: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  workingDays: number | null;
  projectName: string;
  projectId: string | null;
  projectSlug: string | null;
};

export type PendingReviewRow = {
  requestId: string;
  employeeName: string;
  projectName: string;
  projectId: string;
  projectSlug: string | null;
  type: LeaveType;
  startDate: string;
  endDate: string;
  workingDays: number | null;
};

export async function listMyLeaveRequests(
  supabase: AppSupabase,
  userId: string,
  options?: { limit?: number; status?: LeaveStatus; type?: LeaveType; fromDate?: string }
) {
  const limit = options?.limit ?? 5;
  let query = supabase
    .from('leave_requests')
    .select(
      `id, type, start_date, end_date, status, working_days_count, project_id, projects!leave_requests_project_id_fkey(name, slug)`
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.status) query = query.eq('status', options.status);
  if (options?.type) query = query.eq('type', options.type);
  if (options?.fromDate) query = query.gte('end_date', options.fromDate);

  const { data, error } = await query;
  if (error) return { ok: false as const, error: error.message, status: 500 };

  const requests: MyLeaveRequestRow[] = (data || []).map((row) => {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    return {
      id: row.id,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      workingDays: row.working_days_count,
      projectId: row.project_id,
      projectName: project?.name ?? 'Projekat',
      projectSlug: (project as { slug?: string } | null)?.slug ?? null,
    };
  });

  return { ok: true as const, requests };
}

export async function listPendingApprovals(
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
      `id, type, start_date, end_date, working_days_count, status, project_id, ${leaveRequestUserEmbed}(name), projects!leave_requests_project_id_fkey(name, slug)`
    )
    .in('project_id', projectIds)
    .eq('status', 'pending')
    .neq('user_id', reviewerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { ok: false as const, error: error.message, status: 500 };

  const requests: PendingReviewRow[] = (data || []).map((row) => {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    return {
      requestId: row.id,
      employeeName: (Array.isArray(row.users) ? row.users[0] : row.users)?.name ?? 'Zaposlenik',
      projectName: project?.name ?? 'Projekat',
      projectId: row.project_id,
      projectSlug: (project as { slug?: string } | null)?.slug ?? null,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      workingDays: row.working_days_count,
    };
  });

  return { ok: true as const, requests };
}

export async function listAwayThisWeek(
  supabase: AppSupabase,
  userId: string,
  options?: { limit?: number }
) {
  const { data: memberships } = await supabase
    .from('project_members')
    .select('project_id, projects!inner(id, is_archived)')
    .eq('user_id', userId);

  const projectIds = (memberships || [])
    .map((row) => {
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      if (!project || project.is_archived) return null;
      return row.project_id;
    })
    .filter((id): id is string => Boolean(id));

  if (projectIds.length === 0) {
    return {
      ok: true as const,
      entries: [] as Array<{
        id: string;
        type: LeaveType;
        startDate: string;
        endDate: string;
        employeeName: string;
        projectName: string;
        projectId: string;
        projectSlug: string | null;
      }>,
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndIso = weekEnd.toISOString().split('T')[0];
  const limit = options?.limit ?? 8;

  const { data, error } = await supabase
    .from('leave_requests')
    .select(
      `id, type, start_date, end_date, project_id, ${leaveRequestUserEmbed}(name), ${leaveRequestProjectEmbedWithSlug}`
    )
    .in('project_id', projectIds)
    .eq('status', 'approved')
    .lte('start_date', weekEndIso)
    .gte('end_date', today)
    .order('start_date', { ascending: true })
    .limit(limit);

  if (error) return { ok: false as const, error: error.message, status: 500 };

  const entries = (data || []).map((row) => {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    return {
      id: row.id,
      type: row.type,
      startDate: row.start_date,
      endDate: row.end_date,
      employeeName: (Array.isArray(row.users) ? row.users[0] : row.users)?.name ?? 'Zaposlenik',
      projectName: project?.name ?? 'Projekat',
      projectId: row.project_id ?? '',
      projectSlug: (project as { slug?: string } | null)?.slug ?? null,
    };
  });

  return { ok: true as const, entries };
}

export async function listProjectLeaveRequests(
  supabase: AppSupabase,
  userId: string,
  projectId: string,
  options?: { limit?: number; status?: LeaveStatus; type?: LeaveType }
) {
  const { assertProjectMember } = await import('@/lib/projects/membership');
  const access = await assertProjectMember(supabase, userId, projectId);
  if (!access.ok) return access;

  const limit = options?.limit ?? 20;
  let query = supabase
    .from('leave_requests')
    .select(
      `id, type, start_date, end_date, status, working_days_count, ${leaveRequestUserEmbed}(name)`
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (options?.status) query = query.eq('status', options.status);
  if (options?.type) query = query.eq('type', options.type);

  const { data, error } = await query;
  if (error) return { ok: false as const, error: error.message, status: 500 };

  const requests = (data || []).map((row) => ({
    id: row.id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    workingDays: row.working_days_count,
    employeeName: (Array.isArray(row.users) ? row.users[0] : row.users)?.name ?? 'Zaposlenik',
  }));

  return { ok: true as const, requests };
}
