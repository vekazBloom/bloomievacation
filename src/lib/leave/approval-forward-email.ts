import { LeaveApprovalForwardEmail } from '../../../emails/leave-approval-forward';
import { sendEmail } from '@/lib/email/resend';
import { formatLeaveTypeLabel } from '@/lib/email/format';
import { formatDateRange } from '@/lib/utils';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { UserLeaveBalance } from '@/lib/leave/global-balance';

type ServiceClient = AppSupabase;

function formatGlobalBalanceSnapshot(b: UserLeaveBalance | null): string {
  if (!b) return 'Balance not available.';
  const annualPool = Number(b.annual_leave_total || 0) + Number(b.annual_leave_carried_over || 0);
  const annualLeft = annualPool - Number(b.annual_leave_used || 0);
  const sickPool = Number(b.sick_leave_total || 0);
  const sickLeft = sickPool - Number(b.sick_leave_used || 0);
  const relPool = Number(b.religious_leave_total || 0);
  const relLeft = relPool - Number(b.religious_leave_used || 0);
  return [
    `Annual: ${annualLeft.toFixed(1)} / ${annualPool.toFixed(1)} days remaining`,
    `Sick: ${sickLeft.toFixed(1)} / ${sickPool.toFixed(1)} days remaining`,
    `Religious: ${relLeft.toFixed(1)} / ${relPool.toFixed(1)} days remaining`,
  ].join(' · ');
}

/**
 * Sends approval summary copies to addresses configured by the approver.
 * Only for annual and sick. Marks leave_requests.approval_forward_sent_at on full success.
 */
export async function sendLeaveApprovalForwardCopies(
  service: ServiceClient,
  params: { approverUserId: string; leaveRequestId: string }
): Promise<{ error: string | null }> {
  const { data: lr } = await service
    .from('leave_requests')
    .select(
      'id, user_id, project_id, type, status, working_days_count, start_date, end_date, approval_forward_sent_at'
    )
    .eq('id', params.leaveRequestId)
    .maybeSingle();

  if (!lr || lr.status !== 'approved') return { error: null };
  if (lr.approval_forward_sent_at) return { error: null };
  const t = lr.type as string;
  if (t !== 'annual' && t !== 'sick') return { error: null };

  const { data: forwardRows } = await service
    .from('user_leave_approval_forward_emails')
    .select('email')
    .eq('user_id', params.approverUserId);

  const recipients = [...new Set((forwardRows || []).map((r) => (r.email as string).trim()).filter(Boolean))];
  if (recipients.length === 0) return { error: null };

  const [{ data: employee }, { data: approver }, { data: project }, { data: balance }, { data: memberships }] =
    await Promise.all([
      service.from('users').select('name').eq('id', lr.user_id as string).maybeSingle(),
      service.from('users').select('name').eq('id', params.approverUserId).maybeSingle(),
      service.from('projects').select('name').eq('id', lr.project_id as string).maybeSingle(),
      service
        .from('user_leave_balances')
        .select(
          'annual_leave_total, annual_leave_used, annual_leave_carried_over, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used'
        )
        .eq('user_id', lr.user_id as string)
        .maybeSingle(),
      service
        .from('project_members')
        .select('projects(name)')
        .eq('user_id', lr.user_id as string),
    ]);

  const projectNames = new Set<string>();
  const requestProject = (project as { name?: string } | null)?.name;
  if (requestProject) projectNames.add(requestProject);
  for (const row of memberships || []) {
    const p = row.projects as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(p) ? p[0]?.name : p?.name;
    if (name) projectNames.add(name);
  }
  const projectNamesStr =
    projectNames.size === 0 ? '—' : [...projectNames].sort().join(', ');

  const employeeName = (employee as { name?: string } | null)?.name || 'Employee';
  const approverName = (approver as { name?: string } | null)?.name || 'Approver';
  const dateRange = formatDateRange(lr.start_date as string, lr.end_date as string);
  const wd = Number(lr.working_days_count ?? 0);
  const remainingSummary = formatGlobalBalanceSnapshot(balance as UserLeaveBalance | null);

  const subject = `[BloomieVacation] Approved ${formatLeaveTypeLabel(t)} — ${employeeName} (${wd} day${wd === 1 ? '' : 's'})`;

  const react = LeaveApprovalForwardEmail({
    approverName,
    employeeName,
    projectNames: projectNamesStr,
    leaveTypeLabel: formatLeaveTypeLabel(t),
    workingDays: wd,
    dateRange,
    remainingSummary,
  });

  for (const to of recipients) {
    const result = await sendEmail({ to, subject, react });
    if (!result.success) {
      const err = result.error;
      const msg =
        typeof err === 'string'
          ? err
          : err instanceof Error
            ? err.message
            : 'Email send failed';
      return { error: msg };
    }
  }

  const { error: upErr } = await service
    .from('leave_requests')
    .update({ approval_forward_sent_at: new Date().toISOString() })
    .eq('id', params.leaveRequestId);

  if (upErr) return { error: upErr.message };
  return { error: null };
}
