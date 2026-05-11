import { getAnnualAllowance } from '@/lib/leave/balance';

type AnnualBalanceRow = {
  annual_leave_total: number | null;
  annual_leave_used: number | null;
  annual_leave_carried_over: number | null;
};

export function getAnnualRemaining(membership: AnnualBalanceRow) {
  return Math.max(
    0,
    getAnnualAllowance(membership) - Number(membership.annual_leave_used || 0)
  );
}
