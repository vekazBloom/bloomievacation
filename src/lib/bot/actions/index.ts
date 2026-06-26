import { previewReviewLeaveRequest } from '@/lib/bot/review-leave';
import { applyCarryOverDecision } from '@/lib/carry-over/decisions';
import { getAnnualRemaining } from '@/lib/carry-over/remaining';
import { syncReligiousLeaveRequests } from '@/lib/religious/sync';
import { isProjectAdmin } from '@/lib/projects/membership';
import { createServiceClient } from '@/lib/supabase/server';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { ProjectRole } from '@/types/database';

export async function previewCancelLeaveRequest(
  supabase: AppSupabase,
  userId: string,
  requestId: string
) {
  const { data: existing } = await supabase
    .from('leave_requests')
    .select('id, type, start_date, end_date, status, user_id, working_days_count')
    .eq('id', requestId)
    .maybeSingle();

  if (!existing) return { ok: false as const, error: 'Zahtjev nije pronađen.', status: 404 };
  if (existing.user_id !== userId) {
    return { ok: false as const, error: 'Možete otkazati samo vlastite zahtjeve.', status: 403 };
  }
  if (existing.status !== 'pending' && existing.status !== 'approved') {
    return { ok: false as const, error: 'Samo pending ili approved zahtjevi se mogu otkazati.', status: 400 };
  }

  const summary =
    `Otkazivanje zahtjeva\n` +
    `Tip: ${existing.type}\n` +
    `Od: ${existing.start_date} do ${existing.end_date}\n` +
    `Status: ${existing.status}`;

  return { ok: true as const, requestId, summary };
}

export async function confirmCancelLeaveRequest(userId: string, requestId: string) {
  const supabase = createServiceClient();
  const preview = await previewCancelLeaveRequest(supabase, userId, requestId);
  if (!preview.ok) return preview;

  await supabase.from('leave_request_grant_allocations').delete().eq('leave_request_id', requestId);

  const { error } = await supabase
    .from('leave_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId);

  if (error) return { ok: false as const, error: error.message, status: 500 };

  await supabase.from('leave_request_history').insert({
    request_id: requestId,
    action: 'cancelled',
    performed_by: userId,
    snapshot: {},
  });

  return { ok: true as const, message: '✅ Zahtjev je otkazan.' };
}

export async function previewMarkNotificationsRead(supabase: AppSupabase, userId: string) {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  const unread = count ?? 0;
  if (unread === 0) {
    return { ok: false as const, error: 'Nemate nepročitanih notifikacija.', status: 400 };
  }

  return {
    ok: true as const,
    summary: `Označiti ${unread} notifikacija kao pročitane?`,
    unreadCount: unread,
  };
}

export async function confirmMarkNotificationsRead(userId: string) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) return { ok: false as const, error: error.message, status: 500 };
  return { ok: true as const, message: '✅ Sve notifikacije su označene kao pročitane.' };
}

export async function previewReligiousSelection(
  supabase: AppSupabase,
  userId: string,
  year: number,
  holidayIds: string[]
) {
  const { data: holidays } = await supabase
    .from('religious_holidays_pool')
    .select('id, name, date')
    .in('id', holidayIds.length ? holidayIds : ['00000000-0000-0000-0000-000000000000']);

  const names = (holidays || []).map((h) => `${h.name} (${h.date})`).join(', ');
  const summary =
    `Vjerski praznici za ${year}\n` +
    (holidayIds.length === 0 ? 'Ukloni sve odabire.' : `Odabrano: ${names || holidayIds.length + ' praznika'}`);

  return { ok: true as const, year, holidayIds, summary };
}

export async function confirmReligiousSelection(
  userId: string,
  year: number,
  holidayIds: string[]
) {
  const supabase = createServiceClient();
  await supabase.from('user_religious_selections').delete().eq('user_id', userId).eq('year', year);

  if (holidayIds.length > 0) {
    const { error } = await supabase.from('user_religious_selections').insert(
      holidayIds.map((religiousHolidayId) => ({
        user_id: userId,
        religious_holiday_id: religiousHolidayId,
        year,
      }))
    );
    if (error) return { ok: false as const, error: error.message, status: 500 };
  }

  await syncReligiousLeaveRequests(supabase, userId, year, holidayIds);
  return { ok: true as const, message: `✅ Vjerski praznici za ${year} su ažurirani.` };
}

export async function previewCarryOverDecision(
  supabase: AppSupabase,
  userId: string,
  projectId: string,
  year: number,
  decision: 'transferred' | 'lost'
) {
  const { data: membership } = await supabase
    .from('project_members')
    .select('annual_leave_total, annual_leave_used, annual_leave_carried_over')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership) return { ok: false as const, error: 'Članstvo nije pronađeno.', status: 404 };

  const remaining = getAnnualRemaining(membership);
  const label = decision === 'transferred' ? 'prenesi' : 'izgubi';
  const summary =
    `Carry-over odluka za ${year}\n` +
    `Preostalo dana: ${remaining}\n` +
    `Odluka: ${label} preostale dane`;

  return { ok: true as const, projectId, year, decision, remainingDays: remaining, summary };
}

export async function confirmCarryOverDecision(
  userId: string,
  projectId: string,
  year: number,
  decision: 'transferred' | 'lost'
) {
  const supabase = createServiceClient();
  const preview = await previewCarryOverDecision(supabase, userId, projectId, year, decision);
  if (!preview.ok) return preview;

  const { error } = await applyCarryOverDecision(supabase, {
    projectId,
    userId,
    year,
    decision,
    remainingDays: preview.remainingDays,
    decidedBy: userId,
  });

  if (error) return { ok: false as const, error: error.message, status: 500 };
  const label = decision === 'transferred' ? 'preneseno' : 'izgubljeno';
  return { ok: true as const, message: `✅ Carry-over za ${year} je ${label}.` };
}

export async function previewInviteUser(
  supabase: AppSupabase,
  userId: string,
  projectId: string,
  email: string,
  role: ProjectRole = 'employee'
) {
  if (!(await isProjectAdmin(supabase, userId, projectId))) {
    return { ok: false as const, error: 'Samo admin projekta može slati pozivnice.', status: 403 };
  }

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).maybeSingle();
  if (!project) return { ok: false as const, error: 'Projekat nije pronađen.', status: 404 };

  const summary =
    `Pozivnica na projekat\n` +
    `Projekat: ${project.name}\n` +
    `Email: ${email.trim().toLowerCase()}\n` +
    `Uloga: ${role}`;

  return {
    ok: true as const,
    projectId,
    email: email.trim().toLowerCase(),
    role,
    summary,
  };
}

export async function confirmInviteUser(
  userId: string,
  projectId: string,
  email: string,
  role: ProjectRole
) {
  const supabase = createServiceClient();
  const preview = await previewInviteUser(supabase, userId, projectId, email, role);
  if (!preview.ok) return preview;

  const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).maybeSingle();

  const { error } = await supabase.from('invitations').insert({
    project_id: projectId,
    email: preview.email,
    role,
    invited_by: userId,
    status: 'pending',
  });

  if (error) return { ok: false as const, error: error.message, status: 500 };

  return {
    ok: true as const,
    message: `✅ Pozivnica je poslana na ${preview.email} za projekat ${project?.name ?? ''}.`,
  };
}

export { previewReviewLeaveRequest };
