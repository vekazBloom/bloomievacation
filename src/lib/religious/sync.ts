import { sendReligiousHolidayLoggedEmail } from '@/lib/email/send';
import { createInAppNotification } from '@/lib/notifications/in-app';
import { projectPath } from '@/lib/projects/paths';
import type { AppSupabase } from '@/lib/supabase/app-client';

type ServiceClient = AppSupabase;

function resolveHolidayDate(date: string, year: number, isRecurring: boolean) {
  const source = new Date(date);
  if (!isRecurring) return date;
  const month = String(source.getUTCMonth() + 1).padStart(2, '0');
  const day = String(source.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function syncReligiousLeaveRequests(
  service: ServiceClient,
  userId: string,
  year: number,
  holidayIds: string[]
) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  await service
    .from('leave_requests')
    .delete()
    .eq('user_id', userId)
    .eq('type', 'religious')
    .gte('start_date', yearStart)
    .lte('end_date', yearEnd);

  if (holidayIds.length === 0) return;

  const { data: holidays } = await service
    .from('religious_holidays_pool')
    .select('id, name, date, is_recurring')
    .in('id', holidayIds);

  const { data: memberships } = await service
    .from('project_members')
    .select('project_id, projects(name, slug)')
    .eq('user_id', userId);

  const membershipList = memberships || [];
  if (membershipList.length === 0) return;

  /** One canonical project per auto-logged holiday: avoids N duplicate rows (and N× balance usage) for N teams. */
  const canonicalProjectId = [...membershipList]
    .map((m) => m.project_id as string)
    .filter(Boolean)
    .sort()[0];

  const { data: user } = await service.from('users').select('name, email').eq('id', userId).maybeSingle();

  for (const holiday of holidays || []) {
    const holidayDate = resolveHolidayDate(holiday.date, year, holiday.is_recurring ?? true);
    const { data: request } = await service
      .from('leave_requests')
      .insert({
        user_id: userId,
        project_id: canonicalProjectId,
        type: 'religious',
        start_date: holidayDate,
        end_date: holidayDate,
        working_days_count: 1,
        status: 'approved',
        reason: `Religious holiday: ${holiday.name}`,
      })
      .select('id')
      .single();

    for (const membership of membershipList) {
      const projectMeta = membership.projects as { name?: string; slug?: string } | null;
      const { data: reviewers } = await service
        .from('project_members')
        .select('user_id, users(email, name)')
        .eq('project_id', membership.project_id)
        .in('role', ['admin', 'lead']);

      for (const reviewer of reviewers || []) {
        if (reviewer.user_id === userId) continue;
        await createInAppNotification(service, {
          userId: reviewer.user_id,
          type: 'religious_holiday_logged',
          title: `${user?.name || 'A teammate'} logged ${holiday.name}`,
          message: `Religious holiday on ${holidayDate}`,
          link: projectMeta?.slug ? projectPath(projectMeta.slug, 'calendar') : '/projects',
        });

        const email = (reviewer.users as { email?: string; name?: string } | null)?.email;
        if (email && projectMeta?.slug) {
          await sendReligiousHolidayLoggedEmail({
            to: email,
            managerName: (reviewer.users as { name?: string } | null)?.name || 'Team lead',
            employeeName: user?.name || 'A teammate',
            projectName: projectMeta?.name || 'Project',
            holidayName: holiday.name,
            holidayDate,
            projectSlug: projectMeta.slug,
          });
        }
      }
    }

    if (request?.id) {
      await service.from('leave_request_history').insert({
        request_id: request.id,
        action: 'auto_created',
        performed_by: userId,
        snapshot: { holidayId: holiday.id, year },
      });
    }
  }
}
