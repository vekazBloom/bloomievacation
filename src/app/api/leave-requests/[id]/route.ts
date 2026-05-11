import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  notifyRequestDecision,
  notifyRequestEdited,
} from '@/lib/leave/notify';
import { assertLeaveBalance } from '@/lib/leave/validate-request';
import { canReviewLeave, getCurrentUser } from '@/lib/projects/access';
import { createServiceClient } from '@/lib/supabase/server';

const updateSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel', 'edit']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().nullable().optional(),
  attachmentUrl: z.string().nullable().optional(),
  decisionNote: z.string().nullable().optional(),
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
    .select('*, projects(name)')
    .eq('id', params.id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  const isOwner = existing.user_id === user.id;
  const canReview = await canReviewLeave(existing.project_id, user.id);

  if (parsed.data.action === 'approve' || parsed.data.action === 'reject') {
    if (!canReview) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const status = parsed.data.action === 'approve' ? 'approved' : 'rejected';

    if (status === 'approved') {
      const balanceCheck = await assertLeaveBalance(supabase, {
        userId: existing.user_id,
        projectId: existing.project_id,
        type: existing.type,
        workingDays: existing.working_days_count,
        excludeRequestId: params.id,
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
      })
      .eq('id', params.id)
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('leave_request_history').insert({
      request_id: params.id,
      action: status,
      performed_by: user.id,
      snapshot: data,
    });

    const service = createServiceClient();
    await notifyRequestDecision(service, {
      requestId: params.id,
      projectId: existing.project_id,
      projectName: (existing.projects as { name?: string } | null)?.name || 'Project',
      employeeUserId: existing.user_id,
      leaveType: existing.type,
      startDate: existing.start_date,
      endDate: existing.end_date,
      status,
      reason: parsed.data.decisionNote ?? undefined,
    });

    return NextResponse.json({ request: data });
  }

  if (parsed.data.action === 'cancel') {
    if (!isOwner && !canReview) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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

  const startDate = parsed.data.startDate ?? existing.start_date;
  const endDate = parsed.data.endDate ?? existing.end_date;
  const { data: workingDays } = await supabase.rpc('calculate_working_days', {
    p_start: startDate,
    p_end: endDate,
  });

  const balanceCheck = await assertLeaveBalance(supabase, {
    userId: existing.user_id,
    projectId: existing.project_id,
    type: existing.type,
    workingDays: workingDays ?? existing.working_days_count,
    excludeRequestId: params.id,
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
      working_days_count: workingDays ?? existing.working_days_count,
      status: 'pending',
      decided_by: null,
      decided_at: null,
      decision_note: null,
    })
    .eq('id', params.id)
    .select('*, projects(name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
