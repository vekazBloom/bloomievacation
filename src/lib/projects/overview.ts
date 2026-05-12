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

export type ProjectOverviewMetrics = {
  statusCounts: ProjectOverviewStats['statusCounts'];
  leaveTypeCounts: ProjectOverviewStats['leaveTypeCounts'];
  approvedThisMonth: number;
  awayThisWeek: number;
};

type ProjectMemberRow = {
  annual_leave_total: number;
  annual_leave_used: number;
  sick_leave_total: number;
  sick_leave_used: number;
  religious_leave_total: number;
  religious_leave_used: number;
  users: { name: string };
};

function pct(used: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}

export function buildProjectOverviewStats(
  members: ProjectMemberRow[],
  metrics: ProjectOverviewMetrics,
  upcomingLeave: ProjectOverviewStats['upcomingLeave']
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
    pendingCount: metrics.statusCounts.pending,
    approvedThisMonth: metrics.approvedThisMonth,
    awayThisWeek: metrics.awayThisWeek,
    utilization,
    leaveTypeCounts: metrics.leaveTypeCounts,
    statusCounts: metrics.statusCounts,
    upcomingLeave,
    memberUtilization,
  };
}
