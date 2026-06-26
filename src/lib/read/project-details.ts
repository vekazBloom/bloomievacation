import { assertProjectMember, canUserReviewProject } from '@/lib/projects/membership';
import { loadProjectOverviewMetrics } from '@/lib/projects/overview-data';
import type { AppSupabase } from '@/lib/supabase/app-client';

export async function getProjectDetailsForUser(
  supabase: AppSupabase,
  userId: string,
  projectId: string
) {
  const access = await assertProjectMember(supabase, userId, projectId);
  if (!access.ok) return access;

  const { data, error } = await supabase
    .from('projects')
    .select(
      'id, slug, name, description, vacation_threshold_percent, year_reset_date, accrual_date, carry_over_policy, is_archived'
    )
    .eq('id', projectId)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message, status: 500 };
  if (!data) return { ok: false as const, error: 'Projekat nije pronađen.', status: 404 };

  return {
    ok: true as const,
    project: {
      id: data.id,
      slug: data.slug,
      name: data.name,
      description: data.description,
      vacationThresholdPercent: data.vacation_threshold_percent,
      yearResetDate: data.year_reset_date,
      accrualDate: data.accrual_date,
      carryOverPolicy: data.carry_over_policy,
      isArchived: data.is_archived,
    },
  };
}

export async function getProjectMembersForUser(
  supabase: AppSupabase,
  userId: string,
  projectId: string
) {
  const access = await assertProjectMember(supabase, userId, projectId);
  if (!access.ok) return access;

  const { data, error } = await supabase
    .from('project_members')
    .select('role, users(id, name, email)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) return { ok: false as const, error: error.message, status: 500 };

  const members = (data || []).map((row) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    return {
      userId: user?.id ?? '',
      name: user?.name ?? 'Član',
      email: user?.email ?? '',
      role: row.role,
    };
  });

  return { ok: true as const, members };
}

export async function getProjectOverviewForUser(
  supabase: AppSupabase,
  userId: string,
  projectId: string
) {
  const access = await assertProjectMember(supabase, userId, projectId);
  if (!access.ok) return access;

  try {
    const today = new Date().toISOString().split('T')[0];
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndIso = weekEnd.toISOString().split('T')[0];
    const monthStart = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
    const metrics = await loadProjectOverviewMetrics(
      supabase,
      projectId,
      today,
      weekEndIso,
      monthStart
    );
    const canReview = await canUserReviewProject(supabase, userId, projectId);
    return { ok: true as const, metrics, canReview };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : 'Greška pri učitavanju pregleda.',
      status: 500,
    };
  }
}
