import { sendCarryOverWarningEmail } from '@/lib/email/send';
import { shouldSendEmail } from '@/lib/email/preferences';
import { createInAppNotification } from '@/lib/notifications/in-app';
import { getAnnualRemaining } from '@/lib/carry-over/remaining';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { CarryOverPolicy } from '@/types/database';

type ServiceClient = AppSupabase;

type ProjectRow = {
  id: string;
  name: string;
  year_reset_month: number | null;
  year_reset_day: number | null;
  carry_over_policy: CarryOverPolicy | null;
};

type MemberRow = {
  user_id: string;
  annual_leave_total: number | null;
  annual_leave_used: number | null;
  annual_leave_carried_over: number | null;
};

function isResetDate(project: ProjectRow, date: Date) {
  return (
    date.getMonth() + 1 === Number(project.year_reset_month || 0) &&
    date.getDate() === Number(project.year_reset_day || 0)
  );
}

function daysUntilReset(project: ProjectRow, date: Date) {
  const year = date.getFullYear();
  const resetMonth = Number(project.year_reset_month || 1);
  const resetDay = Number(project.year_reset_day || 1);
  let reset = new Date(year, resetMonth - 1, resetDay);
  if (reset < date) {
    reset = new Date(year + 1, resetMonth - 1, resetDay);
  }
  return Math.ceil((reset.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export async function runYearResetForProject(
  service: ServiceClient,
  project: ProjectRow,
  resetYear: number
) {
  const { data: members } = await service
    .from('project_members')
    .select('user_id, annual_leave_total, annual_leave_used, annual_leave_carried_over')
    .eq('project_id', project.id);

  for (const member of members || []) {
    const remaining = getAnnualRemaining(member);
    const { data: existingDecision } = await service
      .from('carry_over_decisions')
      .select('decision')
      .eq('project_id', project.id)
      .eq('user_id', member.user_id)
      .eq('year', resetYear)
      .maybeSingle();

    let carriedOver = 0;
    if (remaining > 0) {
      if (existingDecision?.decision === 'transferred') {
        carriedOver = remaining;
      } else if (existingDecision?.decision === 'lost') {
        carriedOver = 0;
      } else if (project.carry_over_policy === 'auto_transfer') {
        carriedOver = remaining;
      }
    }

    await service
      .from('project_members')
      .update({
        annual_leave_used: 0,
        annual_leave_carried_over: carriedOver,
      })
      .eq('project_id', project.id)
      .eq('user_id', member.user_id);
  }
}

export async function sendCarryOverWarnings(service: ServiceClient, today = new Date()) {
  const year = today.getFullYear();
  const { data: projects } = await service
    .from('projects')
    .select('id, name, year_reset_month, year_reset_day, carry_over_policy')
    .eq('is_archived', false);

  let warningsSent = 0;

  for (const project of projects || []) {
    if (project.carry_over_policy !== 'ask') continue;
    if (daysUntilReset(project, today) !== 14) continue;

    const { data: members } = await service
      .from('project_members')
      .select('user_id, annual_leave_total, annual_leave_used, annual_leave_carried_over, users(name, email)')
      .eq('project_id', project.id);

    for (const member of members || []) {
      const remaining = getAnnualRemaining(member);
      if (remaining <= 0) continue;

      const { data: decision } = await service
        .from('carry_over_decisions')
        .select('decision')
        .eq('project_id', project.id)
        .eq('user_id', member.user_id)
        .eq('year', year)
        .maybeSingle();

      if (decision?.decision) continue;

      const user = member.users as { name?: string; email?: string } | null;
      await createInAppNotification(service, {
        userId: member.user_id,
        type: 'carry_over_warning',
        title: 'Annual leave carry-over decision needed',
        message: `${remaining} day(s) remain before the ${year} reset.`,
        link: `/projects/${project.id}/carry-over`,
      });

      if (user?.email && (await shouldSendEmail(service, member.user_id))) {
        await sendCarryOverWarningEmail({
          to: user.email,
          employeeName: user.name || 'Team member',
          projectName: project.name,
          daysRemaining: remaining,
          year,
          projectId: project.id,
        });
        warningsSent += 1;
      }
    }
  }

  return { warningsSent };
}

export async function runYearResetJobs(service: ServiceClient, today = new Date()) {
  const { data: projects } = await service
    .from('projects')
    .select('id, name, year_reset_month, year_reset_day, carry_over_policy')
    .eq('is_archived', false);

  let projectsReset = 0;
  for (const project of projects || []) {
    if (!isResetDate(project, today)) continue;
    await runYearResetForProject(service, project, today.getFullYear());
    projectsReset += 1;
  }

  return { projectsReset };
}
