import { getUserLeaveBalance } from '@/lib/leave/global-balance';
import type { AppSupabase } from '@/lib/supabase/app-client';

export type LeaveBalanceSummary = {
  annualRemaining: number;
  annualTotal: number;
  annualUsed: number;
  sickRemaining: number;
  sickTotal: number;
  sickUsed: number;
  religiousRemaining: number;
  religiousTotal: number;
  religiousUsed: number;
};

export async function getMyLeaveBalance(supabase: AppSupabase, userId: string) {
  const { data: balance } = await getUserLeaveBalance(supabase, userId);
  if (!balance) {
    return { ok: false as const, error: 'Nema konfigurisanog stanja godišnjeg odmora.', status: 404 };
  }

  const annualTotal =
    Number(balance.annual_leave_total ?? 0) + Number(balance.annual_leave_carried_over ?? 0);
  const annualUsed = Number(balance.annual_leave_used ?? 0);
  const sickTotal = Number(balance.sick_leave_total ?? 0);
  const sickUsed = Number(balance.sick_leave_used ?? 0);
  const religiousTotal = Number(balance.religious_leave_total ?? 0);
  const religiousUsed = Number(balance.religious_leave_used ?? 0);

  const summary: LeaveBalanceSummary = {
    annualRemaining: Math.max(0, annualTotal - annualUsed),
    annualTotal,
    annualUsed,
    sickRemaining: Math.max(0, sickTotal - sickUsed),
    sickTotal,
    sickUsed,
    religiousRemaining: Math.max(0, religiousTotal - religiousUsed),
    religiousTotal,
    religiousUsed,
  };

  return { ok: true as const, balance: summary };
}
