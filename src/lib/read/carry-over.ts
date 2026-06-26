import { getAnnualRemaining } from '@/lib/carry-over/remaining';
import { assertProjectMember, isProjectAdmin } from '@/lib/projects/membership';
import type { AppSupabase } from '@/lib/supabase/app-client';

export async function getMyCarryOverDecisions(
  supabase: AppSupabase,
  userId: string,
  projectId?: string
) {
  let query = supabase
    .from('carry_over_decisions')
    .select('project_id, year, decision, annual_days_remaining, decided_at, projects(name)')
    .eq('user_id', userId)
    .order('year', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);

  const { data, error } = await query;
  if (error) return { ok: false as const, error: error.message, status: 500 };

  return {
    ok: true as const,
    decisions: (data || []).map((row) => ({
      projectId: row.project_id,
      projectName: (Array.isArray(row.projects) ? row.projects[0] : row.projects)?.name ?? 'Projekat',
      year: row.year,
      decision: row.decision,
      remainingDays: row.annual_days_remaining,
      decidedAt: row.decided_at,
    })),
  };
}

export async function getCarryOverEligibility(
  supabase: AppSupabase,
  userId: string,
  projectId: string,
  year: number,
  targetUserId?: string
) {
  const subjectId = targetUserId ?? userId;
  if (subjectId !== userId) {
    const canManage = await isProjectAdmin(supabase, userId, projectId);
    if (!canManage) {
      return { ok: false as const, error: 'Nemate dozvolu za pregled carry-over drugog korisnika.', status: 403 };
    }
  } else {
    const access = await assertProjectMember(supabase, userId, projectId);
    if (!access.ok) return access;
  }

  const { data: membership, error } = await supabase
    .from('project_members')
    .select('annual_leave_total, annual_leave_used, annual_leave_carried_over')
    .eq('project_id', projectId)
    .eq('user_id', subjectId)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message, status: 500 };
  if (!membership) return { ok: false as const, error: 'Članstvo nije pronađeno.', status: 404 };

  const { data: existing } = await supabase
    .from('carry_over_decisions')
    .select('decision')
    .eq('project_id', projectId)
    .eq('user_id', subjectId)
    .eq('year', year)
    .maybeSingle();

  return {
    ok: true as const,
    year,
    remainingDays: getAnnualRemaining(membership),
    existingDecision: existing?.decision ?? null,
  };
}
