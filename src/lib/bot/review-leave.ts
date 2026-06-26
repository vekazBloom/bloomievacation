import { assertCanReview } from '@/lib/projects/membership';
import { leaveRequestProjectEmbed, leaveRequestUserEmbed } from '@/lib/leave/queries';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { ReviewLeaveAction } from '@/lib/leave/review-request';

const TYPE_LABELS: Record<string, string> = {
  annual: 'Godišnji',
  sick: 'Bolovanje',
  religious: 'Vjerski',
};

export function formatReviewSummary(params: {
  action: ReviewLeaveAction;
  employeeName: string;
  projectName: string;
  type: string;
  startDate: string;
  endDate: string;
  workingDays: number;
}) {
  const actionLabel = params.action === 'approve' ? 'Odobrenje' : 'Odbijanje';
  const typeLabel = TYPE_LABELS[params.type] ?? params.type;
  return (
    `${actionLabel} zahtjeva\n` +
    `Zaposlenik: ${params.employeeName}\n` +
    `Projekat: ${params.projectName}\n` +
    `Tip: ${typeLabel}\n` +
    `Od: ${params.startDate} do ${params.endDate}\n` +
    `Radni dani: ${params.workingDays}`
  );
}

export async function previewReviewLeaveRequest(
  supabase: AppSupabase,
  reviewerId: string,
  requestId: string,
  action: ReviewLeaveAction,
  decisionNote?: string | null
) {
  const { data: existing } = await supabase
    .from('leave_requests')
    .select(`*, ${leaveRequestProjectEmbed}, ${leaveRequestUserEmbed}(name)`)
    .eq('id', requestId)
    .maybeSingle();

  if (!existing) return { ok: false as const, error: 'Zahtjev nije pronađen.', status: 404 };
  if (existing.status !== 'pending') {
    return { ok: false as const, error: 'Zahtjev više nije na čekanju.', status: 400 };
  }
  if (existing.user_id === reviewerId) {
    return { ok: false as const, error: 'Ne možete obraditi vlastiti zahtjev.', status: 403 };
  }

  const access = await assertCanReview(supabase, reviewerId, existing.project_id);
  if (!access.ok) return access;

  const employeeName =
    (Array.isArray(existing.users) ? existing.users[0] : existing.users)?.name ?? 'Zaposlenik';
  const projectName =
    (Array.isArray(existing.projects) ? existing.projects[0] : existing.projects)?.name ?? 'Projekat';

  const summary = formatReviewSummary({
    action,
    employeeName,
    projectName,
    type: existing.type,
    startDate: existing.start_date,
    endDate: existing.end_date,
    workingDays: Number(existing.working_days_count ?? 0),
  });

  return {
    ok: true as const,
    requestId,
    action,
    decisionNote: decisionNote ?? null,
    summary,
  };
}
