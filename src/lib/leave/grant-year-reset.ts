import { format, parseISO, subDays } from 'date-fns';
import type { AppSupabase } from '@/lib/supabase/app-client';
import {
  accrualDateForGrantYear,
  firstUseByDateForGrantYear,
} from '@/lib/leave/entitlement-grants';

function isoDayBefore(accrualIso: string): string {
  return format(subDays(parseISO(`${accrualIso}T12:00:00.000Z`), 1), 'yyyy-MM-dd');
}

/**
 * On the project year-reset date: open the entitlement "vintage" for `resetYear`, and
 * close overlapping legacy / open prior-year grants so eligibility windows do not stack
 * incorrectly after the first yearly grant exists.
 */
export async function openAnnualGrantAfterYearReset(
  service: AppSupabase,
  params: {
    projectId: string;
    userId: string;
    resetYear: number;
    accrualMonth: number;
    accrualDay: number;
    firstUseByMonth: number | null;
    firstUseByDay: number | null;
    daysAllocatedForNewYear: number;
  }
) {
  const accrualIso = accrualDateForGrantYear(
    params.resetYear,
    params.accrualMonth,
    params.accrualDay
  );
  const capBefore = isoDayBefore(accrualIso);

  const { data: existing } = await service
    .from('annual_entitlement_grants')
    .select('id')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .eq('grant_year', params.resetYear)
    .eq('source', 'grant')
    .maybeSingle();

  if (!existing) {
    const validTo = firstUseByDateForGrantYear(
      params.resetYear,
      params.firstUseByMonth,
      params.firstUseByDay
    );

    const { error: insertError } = await service.from('annual_entitlement_grants').insert({
      project_id: params.projectId,
      user_id: params.userId,
      grant_year: params.resetYear,
      label: `Annual ${params.resetYear}`,
      days_allocated: params.daysAllocatedForNewYear,
      valid_from: accrualIso,
      valid_to: validTo,
      source: 'grant',
    });

    if (insertError) {
      console.error('openAnnualGrantAfterYearReset insert', insertError);
    }
  }

  const { data: legacyRows } = await service
    .from('annual_entitlement_grants')
    .select('id, valid_to')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .eq('source', 'legacy_migration');

  for (const row of legacyRows || []) {
    const vto = row.valid_to as string | null;
    if (!vto || vto >= accrualIso) {
      await service
        .from('annual_entitlement_grants')
        .update({ valid_to: capBefore, updated_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  }

  const { error: priorErr } = await service
    .from('annual_entitlement_grants')
    .update({ valid_to: capBefore, updated_at: new Date().toISOString() })
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .eq('source', 'grant')
    .eq('grant_year', params.resetYear - 1)
    .is('valid_to', null);

  if (priorErr) {
    console.error('openAnnualGrantAfterYearReset prior year cap', priorErr);
  }
}
