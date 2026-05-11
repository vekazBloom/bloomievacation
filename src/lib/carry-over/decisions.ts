import type { AppSupabase } from '@/lib/supabase/app-client';

type ServiceClient = AppSupabase;

export async function applyCarryOverDecision(
  service: ServiceClient,
  params: {
    projectId: string;
    userId: string;
    year: number;
    decision: 'transferred' | 'lost';
    remainingDays: number;
    decidedBy: string;
  }
) {
  return service
    .from('carry_over_decisions')
    .upsert(
      {
        user_id: params.userId,
        project_id: params.projectId,
        year: params.year,
        annual_days_remaining: params.remainingDays,
        decision: params.decision,
        decided_by: params.decidedBy,
        decided_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,project_id,year' }
    )
    .select('*')
    .single();
}
