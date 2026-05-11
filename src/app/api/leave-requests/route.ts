import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { notifyRequestSubmitted } from '@/lib/leave/notify';
import { leaveRequestWithUserAvatarSelect } from '@/lib/leave/queries';
import { assertLeaveBalance } from '@/lib/leave/validate-request';
import { getCurrentUser } from '@/lib/projects/access';
import { createServiceClient } from '@/lib/supabase/server';
import type { LeaveType } from '@/types/database';

const createSchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum(['annual', 'sick', 'religious']),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().nullable().optional(),
  attachmentUrl: z.string().nullable().optional(),
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

  const { projectId, type, startDate, endDate, reason, attachmentUrl } = parsed.data;

  const { data: workingDays, error: workingDaysError } = await supabase.rpc(
    'calculate_working_days',
    { p_start: startDate, p_end: endDate }
  );
  if (workingDaysError) {
    return NextResponse.json({ error: workingDaysError.message }, { status: 500 });
  }

  const balanceCheck = await assertLeaveBalance(supabase, {
    userId: user.id,
    projectId,
    type: type as LeaveType,
    workingDays: workingDays ?? 0,
  });
  if (!balanceCheck.ok) {
    return NextResponse.json({ error: balanceCheck.error }, { status: balanceCheck.status });
  }

  const { data: requestRow, error } = await supabase
    .from('leave_requests')
    .insert({
      user_id: user.id,
      project_id: projectId,
      type: type as LeaveType,
      start_date: startDate,
      end_date: endDate,
      working_days_count: workingDays ?? 0,
      status: 'pending',
      reason: reason ?? null,
      attachment_url: attachmentUrl ?? null,
    })
    .select('*, projects(name)')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
