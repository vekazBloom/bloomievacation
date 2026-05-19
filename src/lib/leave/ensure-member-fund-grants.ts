import { syncLegacyGrantWithFundDefinition } from '@/lib/leave/sync-legacy-grant-definition';
import type { AppSupabase } from '@/lib/supabase/app-client';

type FundDefinition = {
  id: string;
  label: string;
  grant_year: number | null;
  valid_from: string;
  valid_to: string | null;
  sort_order: number;
};

async function loadDefinitions(
  db: AppSupabase,
  definitionIds: string[]
): Promise<FundDefinition[]> {
  if (definitionIds.length === 0) return [];
  const { data, error } = await db
    .from('annual_fund_definitions')
    .select('id, label, grant_year, valid_from, valid_to, sort_order')
    .in('id', definitionIds)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error || !data) return [];
  return data as FundDefinition[];
}

function primaryDefinitionId(definitions: FundDefinition[], assignedIds: string[]): string | null {
  const assignedSet = new Set(assignedIds);
  const ordered = definitions.filter((d) => assignedSet.has(d.id));
  if (ordered.length > 0) return ordered[0].id;
  return assignedIds[0] ?? null;
}

/**
 * Ensures each assigned global fund template has an entitlement row for this member in this project.
 * Primary template uses legacy_migration; additional templates get source=grant rows.
 */
export async function ensureMemberFundGrantsForAssignments(
  db: AppSupabase,
  params: {
    projectId: string;
    userId: string;
    assignedDefinitionIds: string[];
  }
): Promise<{ error: string | null }> {
  const unique = [...new Set(params.assignedDefinitionIds.filter(Boolean))];
  if (unique.length === 0) return { error: null };

  const definitions = await loadDefinitions(db, unique);
  if (definitions.length !== unique.length) {
    return { error: 'One or more fund templates were not found.' };
  }

  const primaryId = primaryDefinitionId(definitions, unique);

  const { data: existing, error: exErr } = await db
    .from('annual_entitlement_grants')
    .select('id, definition_id, source')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId);

  if (exErr) return { error: exErr.message };

  const existingDefIds = new Set(
    (existing || []).map((row) => row.definition_id as string | null).filter(Boolean) as string[]
  );

  for (const def of definitions) {
    if (existingDefIds.has(def.id)) continue;

    if (def.id === primaryId) {
      const sync = await syncLegacyGrantWithFundDefinition(db, {
        projectId: params.projectId,
        userId: params.userId,
        definitionId: def.id,
      });
      if (sync.error) return { error: sync.error };
      existingDefIds.add(def.id);
      continue;
    }

    const { error: insErr } = await db.from('annual_entitlement_grants').insert({
      project_id: params.projectId,
      user_id: params.userId,
      grant_year: def.grant_year,
      label: def.label,
      days_allocated: 0,
      valid_from: def.valid_from,
      valid_to: def.valid_to,
      source: 'grant',
      definition_id: def.id,
    });

    if (insErr) return { error: insErr.message };
    existingDefIds.add(def.id);
  }

  return { error: null };
}
