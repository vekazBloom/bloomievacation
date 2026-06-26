import type { AppSupabase } from '@/lib/supabase/app-client';

export async function listAnnualFundDefinitions(supabase: AppSupabase, _userId: string) {
  const { data, error } = await supabase
    .from('annual_fund_definitions')
    .select('id, label, grant_year, valid_from, valid_to, sort_order')
    .order('sort_order', { ascending: true });

  if (error) return { ok: false as const, error: error.message, status: 500 };

  return {
    ok: true as const,
    definitions: (data || []).map((row) => ({
      id: row.id,
      label: row.label,
      grantYear: row.grant_year,
      validFrom: row.valid_from,
      validTo: row.valid_to,
      sortOrder: row.sort_order,
    })),
  };
}
