import type { AppSupabase } from '@/lib/supabase/app-client';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import type { ProjectOverviewMetrics } from '@/lib/projects/overview';

export type { ProjectOverviewMetrics };

type UpcomingRequestRow = {
  id: string;
  user_id: string;
  type: 'annual' | 'sick' | 'religious';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  start_date: string;
  end_date: string;
  created_at: string;
  users?: { name?: string | null } | null;
};

type OverviewCountRow = {
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  cancelled_count: number;
  annual_count: number;
  sick_count: number;
  religious_count: number;
  approved_this_month: number;
  away_this_week: number;
};

function emptyMetrics(): ProjectOverviewMetrics {
  return {
    statusCounts: {
      pending: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
    },
    leaveTypeCounts: {
      annual: 0,
      sick: 0,
      religious: 0,
    },
    approvedThisMonth: 0,
    awayThisWeek: 0,
  };
}

function mapOverviewCountRow(row: OverviewCountRow): ProjectOverviewMetrics {
  return {
    statusCounts: {
      pending: Number(row.pending_count || 0),
      approved: Number(row.approved_count || 0),
      rejected: Number(row.rejected_count || 0),
      cancelled: Number(row.cancelled_count || 0),
    },
    leaveTypeCounts: {
      annual: Number(row.annual_count || 0),
      sick: Number(row.sick_count || 0),
      religious: Number(row.religious_count || 0),
    },
    approvedThisMonth: Number(row.approved_this_month || 0),
    awayThisWeek: Number(row.away_this_week || 0),
  };
}

async function countLeaveRequests(
  supabase: AppSupabase,
  projectId: string,
  filters: (query: any) => any
) {
  let query = supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('project_id', projectId);
  query = filters(query);
  const { count, error } = await query;
  if (error) {
    throw error;
  }
  return count || 0;
}

export async function fetchProjectOverviewMetrics(
  supabase: AppSupabase,
  projectId: string,
  today: string,
  weekEndIso: string,
  monthStart: string
) {
  const { data, error } = await supabase.rpc('project_leave_overview_counts', {
    p_project_id: projectId,
    p_today: today,
    p_week_end: weekEndIso,
    p_month_start: monthStart,
  });

  if (error) {
    throw error;
  }

  const row = (data as OverviewCountRow[] | null)?.[0];
  return row ? mapOverviewCountRow(row) : emptyMetrics();
}

export async function fetchProjectOverviewMetricsFallback(
  supabase: AppSupabase,
  projectId: string,
  today: string,
  weekEndIso: string,
  monthStart: string
) {
  const [
    pendingCount,
    approvedCount,
    rejectedCount,
    cancelledCount,
    annualCount,
    sickCount,
    religiousCount,
    approvedThisMonth,
    awayRows,
  ] = await Promise.all([
    countLeaveRequests(supabase, projectId, (query) => query.eq('status', 'pending')),
    countLeaveRequests(supabase, projectId, (query) => query.eq('status', 'approved')),
    countLeaveRequests(supabase, projectId, (query) => query.eq('status', 'rejected')),
    countLeaveRequests(supabase, projectId, (query) => query.eq('status', 'cancelled')),
    countLeaveRequests(supabase, projectId, (query) => query.eq('type', 'annual')),
    countLeaveRequests(supabase, projectId, (query) => query.eq('type', 'sick')),
    countLeaveRequests(supabase, projectId, (query) => query.eq('type', 'religious')),
    countLeaveRequests(supabase, projectId, (query) =>
      query.eq('status', 'approved').gte('created_at', monthStart)
    ),
    supabase
      .from('leave_requests')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('status', 'approved')
      .lte('start_date', weekEndIso)
      .gte('end_date', today),
  ]);

  const awayThisWeek = new Set(
    (awayRows.data || []).map((row: { user_id: string }) => row.user_id)
  ).size;

  return mapOverviewCountRow({
    pending_count: pendingCount,
    approved_count: approvedCount,
    rejected_count: rejectedCount,
    cancelled_count: cancelledCount,
    annual_count: annualCount,
    sick_count: sickCount,
    religious_count: religiousCount,
    approved_this_month: approvedThisMonth,
    away_this_week: awayThisWeek,
  });
}

export async function loadProjectOverviewMetrics(
  supabase: AppSupabase,
  projectId: string,
  today: string,
  weekEndIso: string,
  monthStart: string
) {
  try {
    return await fetchProjectOverviewMetrics(supabase, projectId, today, weekEndIso, monthStart);
  } catch {
    return fetchProjectOverviewMetricsFallback(supabase, projectId, today, weekEndIso, monthStart);
  }
}

export async function fetchProjectUpcomingRequests(
  supabase: AppSupabase,
  projectId: string,
  today: string
) {
  const { data, error } = await supabase
    .from('leave_requests')
    .select(`id, user_id, type, status, start_date, end_date, created_at, ${leaveRequestUserEmbed}(name)`)
    .eq('project_id', projectId)
    .gte('end_date', today)
    .not('status', 'in', '("rejected","cancelled")')
    .order('start_date', { ascending: true })
    .limit(6);

  if (error) {
    throw error;
  }

  return (data || []) as UpcomingRequestRow[];
}

export function mapUpcomingLeaveRequests(requests: UpcomingRequestRow[]) {
  return requests.map((request) => ({
    id: request.id,
    type: request.type,
    startDate: request.start_date,
    endDate: request.end_date,
    status: request.status,
    userName: request.users?.name || 'Team member',
  }));
}
