import type { LeaveType } from '@/types/database';

type MembershipBalance = {
  annual_leave_total: number | null;
  annual_leave_used: number | null;
  annual_leave_carried_over: number | null;
  sick_leave_total: number | null;
  sick_leave_used: number | null;
  religious_leave_total: number | null;
  religious_leave_used: number | null;
};

type PendingRequest = {
  id: string;
  type: LeaveType;
  working_days_count: number;
};

export function getAnnualAllowance(
  membership: Pick<MembershipBalance, 'annual_leave_total' | 'annual_leave_carried_over'>
) {
  return (
    Number(membership.annual_leave_total || 0) + Number(membership.annual_leave_carried_over || 0)
  );
}

export function getLeaveAllowance(membership: MembershipBalance, type: LeaveType) {
  if (type === 'annual') return getAnnualAllowance(membership);
  if (type === 'sick') return Number(membership.sick_leave_total || 0);
  return Number(membership.religious_leave_total || 0);
}

export function getLeaveUsed(membership: MembershipBalance, type: LeaveType) {
  if (type === 'annual') return Number(membership.annual_leave_used || 0);
  if (type === 'sick') return Number(membership.sick_leave_used || 0);
  return Number(membership.religious_leave_used || 0);
}

export function getPendingDays(
  requests: PendingRequest[],
  type: LeaveType,
  excludeRequestId?: string
) {
  return requests
    .filter((request) => request.type === type && request.id !== excludeRequestId)
    .reduce((sum, request) => sum + Number(request.working_days_count || 0), 0);
}

export function validateLeaveBalance(params: {
  membership: MembershipBalance;
  type: LeaveType;
  workingDays: number;
  pendingRequests: PendingRequest[];
  excludeRequestId?: string;
}) {
  const allowance = getLeaveAllowance(params.membership, params.type);
  const used = getLeaveUsed(params.membership, params.type);
  const pending = getPendingDays(params.pendingRequests, params.type, params.excludeRequestId);
  const remaining = allowance - used - pending;

  if (params.workingDays > remaining) {
    return {
      ok: false as const,
      remaining: Math.max(0, remaining),
      allowance,
      used,
      pending,
    };
  }

  return {
    ok: true as const,
    remaining: remaining - params.workingDays,
    allowance,
    used,
    pending,
  };
}
