import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendLeaveApprovalForwardCopies } from '@/lib/leave/approval-forward-email';
import { formatLeaveTypeLabel } from '@/lib/email/format';

export const dynamic = 'force-dynamic';

const putSchema = z.object({
  emails: z.array(z.string()).max(40),
});

const postSendSchema = z.object({
  requestIds: z.array(z.string().uuid()).min(1),
});

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const [{ data: forwardRows, error: fe }, { data: pending, error: pe }] = await Promise.all([
    supabase
      .from('user_leave_approval_forward_emails')
      .select('email')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('leave_requests')
      .select(
        'id, start_date, end_date, type, working_days_count, decided_at, users!leave_requests_user_id_fkey(name), projects(name)'
      )
      .eq('decided_by', user.id)
      .eq('status', 'approved')
      .in('type', ['annual', 'sick'])
      .is('approval_forward_sent_at', null)
      .order('decided_at', { ascending: false }),
  ]);

  if (fe) return NextResponse.json({ error: fe.message }, { status: 500 });
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });

  const emails = [...new Set((forwardRows || []).map((r) => (r.email as string).trim()))];

  const pendingOut = (pending || []).map((row) => {
    const u = row.users as { name?: string } | { name?: string }[] | null;
    const p = row.projects as { name?: string } | { name?: string }[] | null;
    const employeeName = Array.isArray(u) ? u[0]?.name : u?.name;
    const projectName = Array.isArray(p) ? p[0]?.name : p?.name;
    return {
      id: row.id as string,
      startDate: row.start_date as string,
      endDate: row.end_date as string,
      type: row.type as string,
      typeLabel: formatLeaveTypeLabel(row.type as string),
      workingDays: Number(row.working_days_count ?? 0),
      decidedAt: row.decided_at as string | null,
      employeeName: employeeName || '—',
      projectName: projectName || '—',
    };
  });

  return NextResponse.json({ emails, pending: pendingOut });
}

export async function PUT(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const normalized: string[] = [];
  for (const line of parsed.data.emails) {
    const t = line.trim().toLowerCase();
    if (!t) continue;
    const r = z.string().email().safeParse(t);
    if (!r.success) {
      return NextResponse.json({ error: `Invalid email: ${line.trim()}` }, { status: 400 });
    }
    normalized.push(r.data);
  }
  const unique = [...new Set(normalized)];

  const { error: delErr } = await supabase
    .from('user_leave_approval_forward_emails')
    .delete()
    .eq('user_id', user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (unique.length > 0) {
    const { error: insErr } = await supabase.from('user_leave_approval_forward_emails').insert(
      unique.map((email) => ({
        user_id: user.id,
        email,
      }))
    );
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ emails: unique });
}

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const parsed = postSendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  const { count: forwardCount, error: fcErr } = await supabase
    .from('user_leave_approval_forward_emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (fcErr) return NextResponse.json({ error: fcErr.message }, { status: 500 });
  if (!forwardCount) {
    return NextResponse.json(
      { error: 'Add at least one forwarding address and save before sending.' },
      { status: 400 }
    );
  }

  const { data: rows, error } = await supabase
    .from('leave_requests')
    .select('id')
    .in('id', parsed.data.requestIds)
    .eq('decided_by', user.id)
    .eq('status', 'approved')
    .in('type', ['annual', 'sick'])
    .is('approval_forward_sent_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const allowed = new Set((rows || []).map((r) => r.id as string));
  const invalid = parsed.data.requestIds.filter((id) => !allowed.has(id));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: 'Some requests are not eligible (must be annual/sick, approved by you, and not already forwarded).' },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const id of parsed.data.requestIds) {
    const r = await sendLeaveApprovalForwardCopies(service, {
      approverUserId: user.id,
      leaveRequestId: id,
    });
    results.push({ id, ok: !r.error, error: r.error || undefined });
  }

  const failed = results.filter((x) => !x.ok);
  return NextResponse.json({ results, failedCount: failed.length });
}
