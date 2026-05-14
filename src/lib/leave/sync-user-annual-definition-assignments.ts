import { syncLegacyGrantWithFundDefinition } from '@/lib/leave/sync-legacy-grant-definition';
import type { AppSupabase } from '@/lib/supabase/app-client';

type DbClient = AppSupabase;

/**
 * Replaces global template assignments for a user, then sets each project’s legacy annual grant
 * to the primary template (first by sort_order, then label). Clears legacy definition when the set is empty.
 */
export async function replaceUserAnnualFundAssignmentsAndSyncLegacy(
  db: DbClient,
  userId: string,
  definitionIds: string[]
): Promise<{ error: string | null }> {
  const unique = [...new Set(definitionIds.filter(Boolean))];

  if (unique.length > 0) {
    const { data: defs, error: defErr } = await db.from('annual_fund_definitions').select('id').in('id', unique);
    if (defErr) return { error: defErr.message };
    if (!defs || defs.length !== unique.length) {
      return { error: 'One or more fund templates were not found.' };
    }
  }

  const { error: delErr } = await db.from('user_annual_fund_definition_assignments').delete().eq('user_id', userId);
  if (delErr) return { error: delErr.message };

  if (unique.length > 0) {
    const { error: insErr } = await db.from('user_annual_fund_definition_assignments').insert(
      unique.map((definition_id) => ({ user_id: userId, definition_id }))
    );
    if (insErr) return { error: insErr.message };
  }

  let primaryId: string | null = null;
  if (unique.length > 0) {
    const { data: primaryRow, error: pErr } = await db
      .from('annual_fund_definitions')
      .select('id')
      .in('id', unique)
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (pErr) return { error: pErr.message };
    primaryId = (primaryRow?.id as string | undefined) ?? unique[0];
  }

  const { data: memberships, error: mErr } = await db
    .from('project_members')
    .select('project_id')
    .eq('user_id', userId);
  if (mErr) return { error: mErr.message };

  for (const row of memberships || []) {
    const projectId = row.project_id as string;
    const sync = await syncLegacyGrantWithFundDefinition(db, {
      projectId,
      userId,
      definitionId: primaryId,
    });
    if (sync.error) return { error: sync.error };
  }

  return { error: null };
}
