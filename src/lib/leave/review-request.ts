import { notifyRequestDecision } from '@/lib/leave/notify';
import { assertLeaveBalance } from '@/lib/leave/validate-request';
import { sendLeaveApprovalForwardCopies } from '@/lib/leave/approval-forward-email';
import { leaveRequestProjectEmbed } from '@/lib/leave/queries';
import type { AppSupabase } from '@/lib/supabase/app-client';
import { createServiceClient } from '@/lib/supabase/server';

export type ReviewLeaveAction = 'approve' | 'reject';

export type ReviewLeaveRequestInput = {
  requestId: string;
  reviewerId: string;
  action: ReviewLeaveAction;
  decisionNote?: string | null;
};

export type ReviewLeaveRequestResult =
  | { ok: true; request: Record<string, unknown> }
  | { ok: false; error: string; status: number };

async function canReviewWithServiceClient(supabase: AppSupabase, userId: string, projectId: string) {
  const { data: profile } = await supabase
    .from('users')
    .select('is_system_admin')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.is_system_admin) return true;
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .maybeSingle();
  return membership?.role === 'admin' || membership?.role === 'lead';
}

export async function reviewLeaveRequest(
  supabase: AppSupabase,
  input: ReviewLeaveRequestInput
): Promise<ReviewLeaveRequestResult> {
  const { requestId, reviewerId, action, decisionNote } = input;

  const { data: existing } = await supabase
    .from('leave_requests')
    .select(`*, ${leaveRequestProjectEmbed}`)
    .eq('id', requestId)
    .maybeSingle();

  if (!existing) return { ok: false, error: 'Request not found', status: 404 };
  if (existing.status !== 'pending') {
    return { ok: false, error: 'Samo pending zahtjevi se mogu odobriti ili odbiti.', status: 400 };
  }
  if (existing.user_id === reviewerId) {
    return { ok: false, error: 'Ne možete odobriti vlastiti zahtjev.', status: 403 };
  }

  const canReview = await canReviewWithServiceClient(supabase, reviewerId, existing.project_id);
  if (!canReview) return { ok: false, error: 'Forbidden', status: 403 };

  const status = action === 'approve' ? 'approved' : 'rejected';

  if (status === 'rejected') {
    await supabase.from('leave_request_grant_allocations').delete().eq('leave_request_id', requestId);
  }

  if (status === 'approved' && existing.type === 'sick') {
    const poolId = (existing.balance_project_id as string | null) ?? null;
    if (!poolId) {
      return {
        ok: false,
        error: 'Sick leave requests must have a project pool selected before approval.',
        status: 400,
      };
    }
  }

  if (status === 'approved') {
    const balanceCheck = await assertLeaveBalance(supabase, {
      userId: existing.user_id,
      projectId: existing.project_id,
      type: existing.type,
      workingDays: existing.working_days_count,
      excludeRequestId: requestId,
      balanceProjectId: (existing.balance_project_id as string | null) ?? undefined,
    });
    if (!balanceCheck.ok) {
      return { ok: false, error: balanceCheck.error, status: balanceCheck.status };
    }
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .update({
      status,
      decided_by: reviewerId,
      decided_at: new Date().toISOString(),
      decision_note: decisionNote ?? null,
      ...(status === 'rejected' ? { approval_forward_sent_at: null } : {}),
    })
    .eq('id', requestId)
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message, status: 500 };

  await supabase.from('leave_request_history').insert({
    request_id: requestId,
    action: status,
    performed_by: reviewerId,
    snapshot: data,
  });

  const service = createServiceClient();
  await notifyRequestDecision(service, {
    requestId,
    projectId: existing.project_id,
    projectName: (existing.projects as { name?: string } | null)?.name || 'Project',
    employeeUserId: existing.user_id,
    leaveType: existing.type,
    startDate: existing.start_date,
    endDate: existing.end_date,
    status,
    reason: decisionNote ?? undefined,
  });

  if (status === 'approved') {
    const fwd = await sendLeaveApprovalForwardCopies(service, {
      approverUserId: reviewerId,
      leaveRequestId: requestId,
    });
    if (fwd.error) {
      console.error('[leave-approval-forward]', fwd.error);
    }
  }

  return { ok: true, request: data as Record<string, unknown> };
}
