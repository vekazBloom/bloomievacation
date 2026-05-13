import type { AppSupabase } from '@/lib/supabase/app-client';

type DbClient = AppSupabase;

export type UserLeaveBalance = {
  user_id: string;
  annual_leave_total: number | null;
  annual_leave_used: number | null;
  annual_leave_carried_over: number | null;
  sick_leave_total: number | null;
  sick_leave_used: number | null;
  religious_leave_total: number | null;
  religious_leave_used: number | null;
};

export async function getUserLeaveBalance(supabase: DbClient, userId: string) {
  return supabase
    .from('user_leave_balances')
    .select(
      'user_id, annual_leave_total, annual_leave_used, annual_leave_carried_over, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used'
    )
    .eq('user_id', userId)
    .maybeSingle();
}

export async function syncUserLeaveTotals(
  supabase: DbClient,
  userId: string,
  totals: {
    annual_leave_total?: number;
    annual_leave_carried_over?: number;
    sick_leave_total?: number;
    religious_leave_total?: number;
  }
) {
  const payload = {
    user_id: userId,
    ...totals,
  };

  return supabase.from('user_leave_balances').upsert(payload, { onConflict: 'user_id' });
}

