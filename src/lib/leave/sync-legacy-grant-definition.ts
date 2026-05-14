import type { AppSupabase } from '@/lib/supabase/app-client';

/**
 * Links a member's legacy annual grant to a global fund definition (copies label/dates/year),
 * or clears only `definition_id` when `definitionId` is null.
 */
export async function syncLegacyGrantWithFundDefinition(
  supabase: AppSupabase,
  params: { projectId: string; userId: string; definitionId: string | null }
): Promise<{ error: string | null }> {
  const now = new Date().toISOString();

  if (params.definitionId === null) {
    const { error } = await supabase
      .from('annual_entitlement_grants')
      .update({ definition_id: null, updated_at: now })
      .eq('project_id', params.projectId)
      .eq('user_id', params.userId)
      .eq('source', 'legacy_migration');
    return { error: error?.message ?? null };
  }

  const { data: def, error: dErr } = await supabase
    .from('annual_fund_definitions')
    .select('id, label, grant_year, valid_from, valid_to')
    .eq('id', params.definitionId)
    .maybeSingle();

  if (dErr) return { error: dErr.message };
  if (!def) return { error: 'Fund definition not found' };

  const { data: grant, error: gErr } = await supabase
    .from('annual_entitlement_grants')
    .select('id')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .eq('source', 'legacy_migration')
    .maybeSingle();

  if (gErr) return { error: gErr.message };

  const patch = {
    label: def.label as string,
    valid_from: def.valid_from as string,
    valid_to: def.valid_to as string | null,
    grant_year: def.grant_year as number | null,
    definition_id: def.id as string,
    updated_at: now,
  };

  if (grant) {
    const { error } = await supabase.from('annual_entitlement_grants').update(patch).eq('id', grant.id);
    return { error: error?.message ?? null };
  }

  const { data: m, error: mErr } = await supabase
    .from('project_members')
    .select('annual_leave_total, annual_leave_carried_over')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (mErr) return { error: mErr.message };
  const days = Number(m?.annual_leave_total ?? 0) + Number(m?.annual_leave_carried_over ?? 0);

  const { error: insErr } = await supabase.from('annual_entitlement_grants').insert({
    project_id: params.projectId,
    user_id: params.userId,
    grant_year: def.grant_year,
    label: def.label,
    days_allocated: days,
    valid_from: def.valid_from,
    valid_to: def.valid_to,
    source: 'legacy_migration',
    definition_id: def.id,
  });

  return { error: insErr?.message ?? null };
}
