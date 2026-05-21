import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { notifyRequestSubmitted } from '@/lib/leave/notify';
import {
  fetchGrantsForMember,
  fetchGrantsForUser,
  replaceAnnualAllocations,
  validateExplicitAnnualAllocations,
  type AnnualAllocationInput,
} from '@/lib/leave/entitlement-grants';
import { fetchSickLeavePoolsForUser } from '@/lib/leave/sick-leave-pools';
import { leaveRequestWithUserAvatarSelect } from '@/lib/leave/queries';
import { assertLeaveBalance } from '@/lib/leave/validate-request';
import { getCurrentUser } from '@/lib/projects/access';
import { isValidSickLeaveAttachmentPath } from '@/lib/security/attachment';
import { createServiceClient } from '@/lib/supabase/server';
import type { LeaveType } from '@/types/database';

const createSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['annual', 'sick', 'religious']),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().nullable().optional(),
  attachmentUrl: z.string().nullable().optional(),
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

export async function GET(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const projectId = request.nextUrl.searchParams.get('projectId');
  const status = request.nextUrl.searchParams.get('status');
  const type = request.nextUrl.searchParams.get('type');

  let query = supabase
    .from('leave_requests')
    .select(`${leaveRequestWithUserAvatarSelect}, projects(name)`)
    .order('created_at', { ascending: false });

  if (projectId) query = query.eq('project_id', projectId);
  if (status) query = query.eq('status', status);
  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { projectId, type, startDate, endDate, reason, attachmentUrl, annualAllocations, balanceProjectId } =
    parsed.data;

  if (attachmentUrl && type !== 'sick') {
    return NextResponse.json({ error: 'Attachments are only allowed for sick leave' }, { status: 400 });
  }

  if (attachmentUrl && !isValidSickLeaveAttachmentPath(attachmentUrl, user.id)) {
    return NextResponse.json({ error: 'Invalid attachment path' }, { status: 400 });
  }

  const { data: workingDays, error: workingDaysError } = await supabase.rpc(
    'calculate_working_days',
    { p_start: startDate, p_end: endDate }
  );
  if (workingDaysError) {
    return NextResponse.json({ error: workingDaysError.message }, { status: 500 });
  }

  const wd = workingDays ?? 0;

  let resolvedAnnualAllocations: AnnualAllocationInput[] | undefined =
    type === 'annual' ? annualAllocations : undefined;

  let resolvedBalanceProjectId: string | undefined;

  if (type === 'annual') {
    const grants = await fetchGrantsForUser(supabase, user.id);

    if (grants.length > 0) {
      if (!resolvedAnnualAllocations || resolvedAnnualAllocations.length === 0) {
        return NextResponse.json(
          { error: 'Select which annual fund to use before submitting.' },
          { status: 400 }
        );
      }
      const explicitCheck = validateExplicitAnnualAllocations(grants, resolvedAnnualAllocations);
      if (!explicitCheck.ok) {
        return NextResponse.json({ error: explicitCheck.error }, { status: 400 });
      }
      const sum = resolvedAnnualAllocations.reduce((total, row) => total + row.workingDays, 0);
      if (Math.abs(sum - wd) > 0.02) {
        return NextResponse.json(
          { error: 'Annual fund days must equal the working days for this request.' },
          { status: 400 }
        );
      }
    }
  }

  if (type === 'sick') {
    const pools = await fetchSickLeavePoolsForUser(supabase, user.id);
    if (pools.length === 0) {
      return NextResponse.json({ error: 'No sick leave pool is configured for your account.' }, { status: 400 });
    }
    if (!balanceProjectId) {
      return NextResponse.json(
        { error: 'Select which sick leave pool (project) to use.' },
        { status: 400 }
      );
    }
    if (!pools.some((pool) => pool.projectId === balanceProjectId)) {
      return NextResponse.json({ error: 'Invalid sick leave pool for this user.' }, { status: 400 });
    }
    resolvedBalanceProjectId = balanceProjectId;
  }

  const balanceCheck = await assertLeaveBalance(supabase, {
    userId: user.id,
    projectId,
    type: type as LeaveType,
    workingDays: wd,
    annualAllocations: resolvedAnnualAllocations,
    balanceProjectId: resolvedBalanceProjectId,
  });
  if (!balanceCheck.ok) {
    return NextResponse.json({ error: balanceCheck.error }, { status: balanceCheck.status });
  }

  const insertPayload: Record<string, unknown> = {
    user_id: user.id,
    project_id: projectId,
    type: type as LeaveType,
    start_date: startDate,
    end_date: endDate,
    working_days_count: wd,
    status: 'pending',
    reason: reason ?? null,
    attachment_url: attachmentUrl ?? null,
  };
  if (resolvedBalanceProjectId) {
    insertPayload.balance_project_id = resolvedBalanceProjectId;
  }

  const { data: requestRow, error } = await supabase
    .from('leave_requests')
    .insert(insertPayload)
    .select('*, projects(name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (type === 'annual' && resolvedAnnualAllocations && resolvedAnnualAllocations.length > 0) {
    const { error: allocError } = await replaceAnnualAllocations(supabase, requestRow.id, resolvedAnnualAllocations);
    if (allocError) {
      await supabase.from('leave_requests').delete().eq('id', requestRow.id);
      return NextResponse.json({ error: allocError.message || 'Failed to save entitlement split' }, { status: 500 });
    }
  }

  await supabase.from('leave_request_history').insert({
    request_id: requestRow.id,
    action: 'created',
    performed_by: user.id,
    snapshot: requestRow,
  });

  const service = createServiceClient();
  const { data: employee } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', user.id)
    .maybeSingle();

  await notifyRequestSubmitted(service, {
    projectId,
    requestId: requestRow.id,
    employeeName: employee?.name || user.email || 'Employee',
    employeeEmail: employee?.email || user.email || '',
    projectName: (requestRow.projects as { name?: string } | null)?.name || 'Project',
    leaveType: type as LeaveType,
    startDate,
    endDate,
  });

  return NextResponse.json({ request: requestRow });
}
