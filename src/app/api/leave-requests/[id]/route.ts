import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  notifyRequestDatesChanged,
  notifyRequestDecision,
  notifyRequestEdited,
} from '@/lib/leave/notify';
import {
  allocationsChangeGrantSet,
  resolveDateEditAllocations,
} from '@/lib/leave/resolve-date-edit-allocations';
import { reviewLeaveRequest } from '@/lib/leave/review-request';
import { assertLeaveBalance } from '@/lib/leave/validate-request';
import { canEditMemberLeaveBalances, canReviewLeave, getCurrentUser } from '@/lib/projects/access';
import {
  fetchGrantsForUser,
  fetchProjectFirstUsePolicy,
  grantsEligibleForStartDate,
  validateExplicitAnnualAllocations,
  replaceAnnualAllocations,
  type AnnualAllocationInput,
} from '@/lib/leave/entitlement-grants';
import { fetchSickLeavePoolsForUser } from '@/lib/leave/sick-leave-pools';
import { isValidSickLeaveAttachmentPath } from '@/lib/security/attachment';
import { createServiceClient } from '@/lib/supabase/server';
import { sendLeaveApprovalForwardCopies } from '@/lib/leave/approval-forward-email';
import { leaveRequestProjectEmbed } from '@/lib/leave/queries';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD');

const updateSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel', 'edit']).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  reason: z.string().nullable().optional(),
  attachmentUrl: z.string().nullable().optional(),
  decisionNote: z.string().nullable().optional(),
  annualAllocations: z
    .array(
      z.object({
        grantId: z.string().uuid(),
        workingDays: z.number().positive(),
      })
    )
    .optional(),
  balanceProjectId: z.string().uuid().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { data: existing } = await supabase
    .from('leave_requests')
    .select(`*, ${leaveRequestProjectEmbed}`)
    .eq('id', params.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const isOwner = existing.user_id === user.id;
  const canReview = await canReviewLeave(existing.project_id, user.id);

  if (parsed.data.action === 'approve' || parsed.data.action === 'reject') {
    if (!canReview) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const allocationUpdate = parsed.data.annualAllocations;
    const hasFundEdits =
      Boolean(allocationUpdate?.length) || Boolean(parsed.data.balanceProjectId);

    const startDate = parsed.data.startDate ?? existing.start_date;
    const endDate = parsed.data.endDate ?? existing.end_date;
    const datesChanged = startDate !== existing.start_date || endDate !== existing.end_date;

    if (endDate < startDate) {
      return NextResponse.json(
        { error: 'End date must be on or after the start date.' },
        { status: 400 }
      );
    }

    /** Plain first-time decision with nothing else changing — the shared helper covers it. */
    if (!hasFundEdits && !datesChanged && existing.status === 'pending') {
      const result = await reviewLeaveRequest(supabase, {
        requestId: params.id,
        reviewerId: user.id,
        action: parsed.data.action,
        decisionNote: parsed.data.decisionNote ?? null,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ request: result.request });
    }

    if (existing.user_id === user.id) {
      return NextResponse.json({ error: 'Ne možete odobriti vlastiti zahtjev.' }, { status: 403 });
    }

    const status = parsed.data.action === 'approve' ? 'approved' : 'rejected';
    const statusChanged = existing.status !== status;

    let workingDays = Number(existing.working_days_count);
    if (datesChanged) {
      const { data: recomputed, error: workingDaysError } = await supabase.rpc(
        'calculate_working_days',
        { p_start: startDate, p_end: endDate }
      );
      if (workingDaysError) {
        return NextResponse.json({ error: workingDaysError.message }, { status: 500 });
      }
      workingDays = Number(recomputed ?? 0);
      if (workingDays <= 0) {
        return NextResponse.json(
          { error: 'These dates contain no working days. Pick a range with at least one working day.' },
          { status: 400 }
        );
      }
    }

    if (status === 'rejected') {
      await supabase.from('leave_request_grant_allocations').delete().eq('leave_request_id', params.id);
    }

    const canReallocateFunds = await canEditMemberLeaveBalances(user.id);
    let balanceProjectUpdate: string | undefined;

    if (parsed.data.balanceProjectId && existing.type === 'sick') {
      if (!canReallocateFunds) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const pools = await fetchSickLeavePoolsForUser(supabase, existing.user_id);
      if (!pools.some((pool) => pool.projectId === parsed.data.balanceProjectId)) {
        return NextResponse.json({ error: 'Invalid sick leave pool for this user.' }, { status: 400 });
      }
      balanceProjectUpdate = parsed.data.balanceProjectId;
    }

    /**
     * Only re-derive the fund split when something forces it. Approving an untouched multi-fund
     * request must leave its existing rows exactly as the employee created them.
     */
    let resolvedAllocations: AnnualAllocationInput[] | undefined;
    if (status === 'approved' && existing.type === 'annual' && (datesChanged || allocationUpdate?.length)) {
      const { data: currentAllocations } = await supabase
        .from('leave_request_grant_allocations')
        .select('grant_id, working_days')
        .eq('leave_request_id', params.id);

      const resolution = resolveDateEditAllocations({
        workingDays,
        existing: currentAllocations ?? [],
        explicit: allocationUpdate,
      });
      if (!resolution.ok) {
        return NextResponse.json({ error: resolution.error }, { status: 400 });
      }
      resolvedAllocations = resolution.allocations;

      if (resolvedAllocations.length > 0) {
        /**
         * Rescaling the same fund is a consequence of the new dates, so any reviewer may do it.
         * Moving days onto a different fund is a balance edit, reserved for system admins.
         */
        if (
          allocationsChangeGrantSet(currentAllocations ?? [], resolvedAllocations) &&
          !canReallocateFunds
        ) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const grants = await fetchGrantsForUser(supabase, existing.user_id);
        const explicitCheck = validateExplicitAnnualAllocations(grants, resolvedAllocations);
        if (!explicitCheck.ok) {
          return NextResponse.json({ error: explicitCheck.error }, { status: 400 });
        }
      }
    }

    if (status === 'approved' && existing.type === 'sick') {
      const poolId =
        balanceProjectUpdate ?? (existing.balance_project_id as string | null) ?? null;
      if (!poolId) {
        return NextResponse.json(
          { error: 'Sick leave requests must have a project pool selected before approval.' },
          { status: 400 }
        );
      }
    }

    if (status === 'approved') {
      const balanceCheck = await assertLeaveBalance(supabase, {
        userId: existing.user_id,
        projectId: existing.project_id,
        type: existing.type,
        workingDays,
        excludeRequestId: params.id,
        annualAllocations: resolvedAllocations,
        balanceProjectId:
          balanceProjectUpdate ??
          (existing.balance_project_id as string | null) ??
          undefined,
      });
      if (!balanceCheck.ok) {
        return NextResponse.json({ error: balanceCheck.error }, { status: balanceCheck.status });
      }
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .update({
        status,
        decided_by: user.id,
        decided_at: new Date().toISOString(),
        decision_note: parsed.data.decisionNote ?? null,
        ...(datesChanged
          ? { start_date: startDate, end_date: endDate, working_days_count: workingDays }
          : {}),
        ...(balanceProjectUpdate ? { balance_project_id: balanceProjectUpdate } : {}),
        ...(status === 'rejected' ? { approval_forward_sent_at: null } : {}),
      })
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (resolvedAllocations?.length) {
      /** Service client: project leads may review but cannot write allocation rows under RLS. */
      const { error: allocError } = await replaceAnnualAllocations(
        createServiceClient(),
        params.id,
        resolvedAllocations
      );
      if (allocError) {
        /** Put the request back so the balance trigger reverses the day delta it just applied. */
        await supabase
          .from('leave_requests')
          .update({
            status: existing.status,
            decided_by: existing.decided_by,
            decided_at: existing.decided_at,
            decision_note: existing.decision_note,
            start_date: existing.start_date,
            end_date: existing.end_date,
            working_days_count: existing.working_days_count,
          })
          .eq('id', params.id);
        return NextResponse.json({ error: allocError.message }, { status: 500 });
      }
    }

    await supabase.from('leave_request_history').insert({
      request_id: params.id,
      action: datesChanged && !statusChanged ? 'edited' : status,
      performed_by: user.id,
      snapshot: {
        ...data,
        ...(datesChanged
          ? {
              previous_start_date: existing.start_date,
              previous_end_date: existing.end_date,
              previous_working_days_count: existing.working_days_count,
            }
          : {}),
      },
    });

    const service = createServiceClient();
    const projectName = (existing.projects as { name?: string } | null)?.name || 'Project';

    if (datesChanged && !statusChanged) {
      const { data: editor } = await supabase
        .from('users')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();

      await notifyRequestDatesChanged(service, {
        requestId: params.id,
        projectId: existing.project_id,
        projectName,
        employeeUserId: existing.user_id,
        editorUserId: user.id,
        editorName: editor?.name || 'A reviewer',
        leaveType: existing.type,
        previousStartDate: existing.start_date,
        previousEndDate: existing.end_date,
        startDate,
        endDate,
        previousWorkingDays: Number(existing.working_days_count),
        workingDays,
      });
    } else {
      await notifyRequestDecision(service, {
        requestId: params.id,
        projectId: existing.project_id,
        projectName,
        employeeUserId: existing.user_id,
        leaveType: existing.type,
        startDate,
        endDate,
        status,
        reason: parsed.data.decisionNote ?? undefined,
      });
    }

    if (status === 'approved') {
      const fwd = await sendLeaveApprovalForwardCopies(service, {
        approverUserId: user.id,
        leaveRequestId: params.id,
        /** New dates invalidate any copy already forwarded for the old ones. */
        resend: datesChanged,
      });
      if (fwd.error) {
        console.error('[leave-approval-forward]', fwd.error);
      }
    }

    return NextResponse.json({ request: data });
  }

  if (parsed.data.action === 'cancel') {
    if (!isOwner && !canReview) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (existing.status !== 'pending' && existing.status !== 'approved') {
      return NextResponse.json({ error: 'Only pending or approved requests can be cancelled' }, { status: 400 });
    }

    await supabase.from('leave_request_grant_allocations').delete().eq('leave_request_id', params.id);

    const { data, error } = await supabase
      .from('leave_requests')
      .update({ status: 'cancelled' })
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('leave_request_history').insert({
      request_id: params.id,
      action: 'cancelled',
      performed_by: user.id,
      snapshot: data,
    });

    return NextResponse.json({ request: data });
  }

  if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (
    parsed.data.attachmentUrl &&
    !isValidSickLeaveAttachmentPath(parsed.data.attachmentUrl, existing.user_id)
  ) {
    return NextResponse.json({ error: 'Invalid attachment path' }, { status: 400 });
  }

  const startDate = parsed.data.startDate ?? existing.start_date;
  const endDate = parsed.data.endDate ?? existing.end_date;
  const { data: workingDays } = await supabase.rpc('calculate_working_days', {
    p_start: startDate,
    p_end: endDate,
  });

  const wd = workingDays ?? existing.working_days_count;

  let resolvedAnnualAllocations: AnnualAllocationInput[] | undefined;
  if (existing.type === 'annual') {
    const [grants, policy] = await Promise.all([
      fetchGrantsForUser(supabase, existing.user_id),
      fetchProjectFirstUsePolicy(supabase, existing.project_id),
    ]);
    resolvedAnnualAllocations = parsed.data.annualAllocations;
    const hasExplicitAllocations =
      Boolean(resolvedAnnualAllocations && resolvedAnnualAllocations.length > 0);

    if (hasExplicitAllocations) {
      const explicitCheck = validateExplicitAnnualAllocations(grants, resolvedAnnualAllocations!);
      if (!explicitCheck.ok) {
        return NextResponse.json({ error: explicitCheck.error }, { status: 400 });
      }
    } else {
      const eligible = grantsEligibleForStartDate(grants, startDate, policy);
      if (eligible.length === 0 && grants.length > 0) {
        return NextResponse.json(
          { error: 'No annual entitlement fund is valid for the start date of this request.' },
          { status: 400 }
        );
      }
      if (eligible.length >= 2) {
        return NextResponse.json(
          {
            error:
              'Multiple annual funds apply. Send annualAllocations totalling working days when editing dates.',
          },
          { status: 400 }
        );
      }
      if (eligible.length === 1) {
        resolvedAnnualAllocations = [{ grantId: eligible[0].id, workingDays: Number(wd) }];
      }
    }
  }

  const balanceCheck = await assertLeaveBalance(supabase, {
    userId: existing.user_id,
    projectId: existing.project_id,
    type: existing.type,
    workingDays: Number(wd),
    excludeRequestId: params.id,
    annualAllocations: resolvedAnnualAllocations,
  });
  if (!balanceCheck.ok) {
    return NextResponse.json({ error: balanceCheck.error }, { status: balanceCheck.status });
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .update({
      start_date: startDate,
      end_date: endDate,
      reason: parsed.data.reason ?? existing.reason,
      attachment_url: parsed.data.attachmentUrl ?? existing.attachment_url,
      working_days_count: Number(wd),
      status: 'pending',
      decided_by: null,
      decided_at: null,
      decision_note: null,
    })
    .eq('id', params.id)
    .select(`*, ${leaveRequestProjectEmbed}`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (existing.type === 'annual' && resolvedAnnualAllocations && resolvedAnnualAllocations.length > 0) {
    const { error: allocError } = await replaceAnnualAllocations(supabase, params.id, resolvedAnnualAllocations);
    if (allocError) return NextResponse.json({ error: allocError.message }, { status: 500 });
  }

  await supabase.from('leave_request_history').insert({
    request_id: params.id,
    action: 'edited',
    performed_by: user.id,
    snapshot: data,
  });

  const service = createServiceClient();
  const { data: editor } = await supabase.from('users').select('name').eq('id', user.id).maybeSingle();
  await notifyRequestEdited(service, {
    requestId: params.id,
    projectId: existing.project_id,
    projectName: (existing.projects as { name?: string } | null)?.name || 'Project',
    editorName: editor?.name || 'Employee',
    leaveType: existing.type,
    startDate,
    endDate,
  });

  return NextResponse.json({ request: data });
}
