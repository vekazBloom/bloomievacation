type ProjectMemberRow = {
  annual_leave_total: number;
  annual_leave_used: number;
  sick_leave_total: number;
  sick_leave_used: number;
  religious_leave_total: number;
  religious_leave_used: number;
  users: { name: string };
};

type LeaveRequestRow = {
  id: string;
  user_id: string;
  type: 'annual' | 'sick' | 'religious';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  start_date: string;
  end_date: string;
  working_days_count: number;
  created_at: string;
  users?: { name?: string | null } | null;
};

export type ProjectOverviewStats = {
  memberCount: number;
  pendingCount: number;
  approvedThisMonth: number;
  awayThisWeek: number;
  utilization: {
    annualUsed: number;
    annualTotal: number;
    sickUsed: number;
    sickTotal: number;
    religiousUsed: number;
    religiousTotal: number;
  };
  leaveTypeCounts: {
    annual: number;
    sick: number;
    religious: number;
  };
  statusCounts: {
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
  };
  upcomingLeave: Array<{
    id: string;
    type: string;
    startDate: string;
    endDate: string;
    status: string;
    userName: string;
  }>;
  memberUtilization: Array<{
    name: string;
    annualPct: number;
    sickPct: number;
    religiousPct: number;
  }>;
};

function pct(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

export function buildProjectOverviewStats(
  members: ProjectMemberRow[],
  requests: LeaveRequestRow[],
  today: string,
  weekEndIso: string,
  monthStart: string
): ProjectOverviewStats {
  const utilization = members.reduce(
    (acc, member) => ({
      annualUsed: acc.annualUsed + Number(member.annual_leave_used || 0),
      annualTotal: acc.annualTotal + Number(member.annual_leave_total || 0),
      sickUsed: acc.sickUsed + Number(member.sick_leave_used || 0),
      sickTotal: acc.sickTotal + Number(member.sick_leave_total || 0),
      religiousUsed: acc.religiousUsed + Number(member.religious_leave_used || 0),
      religiousTotal: acc.religiousTotal + Number(member.religious_leave_total || 0),
    }),
    {
      annualUsed: 0,
      annualTotal: 0,
      sickUsed: 0,
      sickTotal: 0,
      religiousUsed: 0,
      religiousTotal: 0,
    }
  );

  const statusCounts = {
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  };

  const leaveTypeCounts = {
    annual: 0,
    sick: 0,
    religious: 0,
  };

  let approvedThisMonth = 0;
  let awayThisWeek = 0;
  const awayUsers = new Set<string>();

  for (const request of requests) {
    statusCounts[request.status] += 1;
    leaveTypeCounts[request.type] += 1;

    if (request.status === 'approved' && request.created_at >= monthStart) {
      approvedThisMonth += 1;
    }

    if (
      request.status === 'approved' &&
      request.start_date <= weekEndIso &&
      request.end_date >= today
    ) {
      awayUsers.add(request.user_id);
    }
  }

  awayThisWeek = awayUsers.size;

  const upcomingLeave = requests
    .filter((request) => request.status !== 'rejected' && request.status !== 'cancelled' && request.end_date >= today)
    .sort((left, right) => left.start_date.localeCompare(right.start_date))
    .slice(0, 6)
    .map((request) => ({
      id: request.id,
      type: request.type,
      startDate: request.start_date,
      endDate: request.end_date,
      status: request.status,
      userName: request.users?.name || 'Team member',
    }));

  const memberUtilization = members
    .map((member) => ({
      name: member.users.name,
      annualPct: pct(Number(member.annual_leave_used || 0), Number(member.annual_leave_total || 0)),
      sickPct: pct(Number(member.sick_leave_used || 0), Number(member.sick_leave_total || 0)),
      religiousPct: pct(
        Number(member.religious_leave_used || 0),
        Number(member.religious_leave_total || 0)
      ),
    }))
    .sort((left, right) => right.annualPct - left.annualPct)
    .slice(0, 6);

  return {
    memberCount: members.length,
    pendingCount: statusCounts.pending,
    approvedThisMonth,
    awayThisWeek,
    utilization,
    leaveTypeCounts,
    statusCounts,
    upcomingLeave,
    memberUtilization,
  };
}
