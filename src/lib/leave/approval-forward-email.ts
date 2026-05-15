import { LeaveApprovalForwardEmail } from '../../../emails/leave-approval-forward';
import { sendEmail } from '@/lib/email/resend';
import { formatLeaveTypeLabel } from '@/lib/email/format';
import { formatDateRange } from '@/lib/utils';
import type { AppSupabase } from '@/lib/supabase/app-client';
import {
  fetchGrantsForMember,
  grantsEligibleForStartDate,
  grantRemaining,
  sumAllocatedToGrant,
  type AnnualGrantRow,
} from '@/lib/leave/entitlement-grants';
import { formatAllocatedDays } from '@/lib/leave/format-allocated-days';

type ServiceClient = AppSupabase;

export type ApprovalForwardFundBalance = {
  fundName: string;
  fundPool: number;
  daysThisRequest: number;
  usedOnFund: number;
  remaining: number;
};

function formatPoolRemaining(remaining: number, pool: number): string {
  return `${formatAllocatedDays(remaining)} of ${formatAllocatedDays(pool)} days remaining`;
}

function daysOnGrantFromRequest(
  allocRows: { grant_id: string; working_days: number | string }[] | null,
  grantId: string,
  fallbackWorkingDays: number
): number {
  if (!allocRows?.length) return fallbackWorkingDays;
  const onGrant = allocRows
    .filter((r) => r.grant_id === grantId)
    .reduce((s, r) => s + Number(r.working_days || 0), 0);
  return onGrant > 0 ? onGrant : fallbackWorkingDays;
}

function pickAnnualGrantsForRequest(
  grants: AnnualGrantRow[],
  startDate: string,
  allocRows: { grant_id: string }[] | null
): AnnualGrantRow[] {
  const grantById = new Map(grants.map((g) => [g.id, g]));
  const fromAlloc = [...new Set((allocRows || []).map((r) => r.grant_id))]
    .map((id) => grantById.get(id))
    .filter((g): g is AnnualGrantRow => Boolean(g));

  if (fromAlloc.length > 0) return fromAlloc;

  const eligible = grantsEligibleForStartDate(grants, startDate);
  if (eligible.length > 0) return eligible;

  return grants.length > 0 ? [grants[0]] : [];
}

async function resolveAnnualFundBalances(
  service: ServiceClient,
  params: {
    userId: string;
    projectId: string;
    leaveRequestId: string;
    startDate: string;
    workingDaysThisRequest: number;
  }
): Promise<ApprovalForwardFundBalance[]> {
  const { data: allocRows } = await service
    .from('leave_request_grant_allocations')
    .select('grant_id, working_days')
    .eq('leave_request_id', params.leaveRequestId);

  const grants = await fetchGrantsForMember(service, params.projectId, params.userId);
  const targetGrants = pickAnnualGrantsForRequest(
    grants,
    params.startDate,
    allocRows as { grant_id: string }[] | null
  );

  const balances: ApprovalForwardFundBalance[] = [];

  for (const grant of targetGrants) {
    const usedOnFund = await sumAllocatedToGrant(service, grant.id, {
      statuses: ['approved'],
    });
    const pool = Number(grant.days_allocated || 0);
    const remaining = Math.max(0, grantRemaining(grant, usedOnFund));
    const daysThisRequest = daysOnGrantFromRequest(
      allocRows as { grant_id: string; working_days: number | string }[] | null,
      grant.id,
      params.workingDaysThisRequest
    );

    balances.push({
      fundName: grant.label || 'Annual fund',
      fundPool: pool,
      daysThisRequest,
      usedOnFund,
      remaining,
    });
  }

  return balances;
}

/** Project-scoped balance (or annual fund), not global user_leave_balances. */
async function resolveLeaveApprovalBalanceSummary(
  service: ServiceClient,
  params: {
    userId: string;
    projectId: string;
    leaveRequestId: string;
    startDate: string;
    workingDaysThisRequest: number;
    leaveType: 'annual' | 'sick';
  }
): Promise<{
  fundBalances: ApprovalForwardFundBalance[];
  summary: string;
  balanceLabel: string;
}> {
  if (params.leaveType === 'sick') {
    const { data: pm } = await service
      .from('project_members')
      .select('sick_leave_total, sick_leave_used')
      .eq('project_id', params.projectId)
      .eq('user_id', params.userId)
      .maybeSingle();

    if (!pm) {
      return {
        fundBalances: [],
        summary: 'Balance not available.',
        balanceLabel: 'Sick leave remaining',
      };
    }

    const pool = Number(pm.sick_leave_total || 0);
    const used = Number(pm.sick_leave_used || 0);
    const remaining = Math.max(0, pool - used);
    return {
      fundBalances: [],
      summary: formatPoolRemaining(remaining, pool),
      balanceLabel: 'Sick leave remaining',
    };
  }

  const fundBalances = await resolveAnnualFundBalances(service, params);

  if (fundBalances.length > 0) {
    const summary = fundBalances
      .map(
        (b) =>
          `${b.fundName}: ${formatAllocatedDays(b.daysThisRequest)} day(s) from this approval · ${formatPoolRemaining(b.remaining, b.fundPool)}`
      )
      .join(' · ');

    return {
      fundBalances,
      summary,
      balanceLabel:
        fundBalances.length === 1 ? 'Annual fund (after approval)' : 'Annual funds (after approval)',
    };
  }

  const { data: pm } = await service
    .from('project_members')
    .select('annual_leave_total, annual_leave_used, annual_leave_carried_over')
    .eq('project_id', params.projectId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (!pm) {
    return {
      fundBalances: [],
      summary: 'Balance not available.',
      balanceLabel: 'Annual leave remaining',
    };
  }

  const pool =
    Number(pm.annual_leave_total || 0) + Number(pm.annual_leave_carried_over || 0);
  const used = Number(pm.annual_leave_used || 0);
  const remaining = Math.max(0, pool - used);
  return {
    fundBalances: [],
    summary: formatPoolRemaining(remaining, pool),
    balanceLabel: 'Annual leave remaining',
  };
}

function collectActiveProjectNames(
  requestProject: { name?: string; is_archived?: boolean | null } | null,
  memberships: { projects: unknown }[] | null
): string {
  const projectNames = new Set<string>();

  if (requestProject?.name && !requestProject.is_archived) {
    projectNames.add(requestProject.name);
  }

  for (const row of memberships || []) {
    const p = row.projects as
      | { name?: string; is_archived?: boolean | null }
      | { name?: string; is_archived?: boolean | null }[]
      | null;
    const project = Array.isArray(p) ? p[0] : p;
    if (project?.name && !project.is_archived) {
      projectNames.add(project.name);
    }
  }

  return projectNames.size === 0 ? '—' : [...projectNames].sort().join(', ');
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
    .eq('user_id', params.approverUserId)
    .eq('send_enabled', true);

  const recipients = [...new Set((forwardRows || []).map((r) => (r.email as string).trim()).filter(Boolean))];
  if (recipients.length === 0) return { error: null };

  const [{ data: employee }, { data: approver }, { data: project }, { data: memberships }] =
    await Promise.all([
      service.from('users').select('name').eq('id', lr.user_id as string).maybeSingle(),
      service.from('users').select('name').eq('id', params.approverUserId).maybeSingle(),
      service
        .from('projects')
        .select('name, is_archived')
        .eq('id', lr.project_id as string)
        .maybeSingle(),
      service
        .from('project_members')
        .select('projects(name, is_archived)')
        .eq('user_id', lr.user_id as string),
    ]);

  const projectNamesStr = collectActiveProjectNames(
    project as { name?: string; is_archived?: boolean | null } | null,
    memberships
  );

  const employeeName = (employee as { name?: string } | null)?.name || 'Employee';
  const approverName = (approver as { name?: string } | null)?.name || 'Approver';
  const dateRange = formatDateRange(lr.start_date as string, lr.end_date as string);
  const wd = Number(lr.working_days_count ?? 0);
  const leaveType = t as 'annual' | 'sick';
  const { fundBalances, summary: remainingSummary, balanceLabel } =
    await resolveLeaveApprovalBalanceSummary(
    service,
    {
      userId: lr.user_id as string,
      projectId: lr.project_id as string,
      leaveRequestId: params.leaveRequestId,
      startDate: lr.start_date as string,
      workingDaysThisRequest: wd,
      leaveType,
    }
  );

  const subject = `[BloomieVacation] Approved ${formatLeaveTypeLabel(t)} — ${employeeName} (${wd} day${wd === 1 ? '' : 's'})`;

  const react = LeaveApprovalForwardEmail({
    approverName,
    employeeName,
    projectNames: projectNamesStr,
    leaveTypeLabel: formatLeaveTypeLabel(t),
    workingDays: wd,
    dateRange,
    remainingSummary,
    balanceLabel,
    fundBalances,
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
