import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { sendLeaveApprovalForwardCopies } from '@/lib/leave/approval-forward-email';
import { formatLeaveTypeLabel } from '@/lib/email/format';

export const dynamic = 'force-dynamic';

const addressSchema = z.object({
  email: z.string(),
  sendEnabled: z.boolean(),
});

const putSchema = z.object({
  addresses: z.array(addressSchema).max(40),
});

const postSendSchema = z.object({
  requestIds: z.array(z.string().uuid()).min(1),
});

export type ForwardAddressDto = {
  id: string;
  email: string;
  sendEnabled: boolean;
};

function mapForwardRows(
  rows: { id: string; email: string; send_enabled: boolean }[] | null
): ForwardAddressDto[] {
  return (rows || []).map((r) => ({
    id: r.id,
    email: r.email.trim(),
    sendEnabled: r.send_enabled,
  }));
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) return NextResponse.json({ error: authError.message }, { status: 401 });
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const [{ data: forwardRows, error: fe }, { data: approvalRows, error: pe }] = await Promise.all([
    supabase
      .from('user_leave_approval_forward_emails')
      .select('id, email, send_enabled')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('leave_requests')
      .select(
        'id, start_date, end_date, type, working_days_count, decided_at, approval_forward_sent_at, users!leave_requests_user_id_fkey(name), projects(name)'
      )
      .eq('decided_by', user.id)
      .eq('status', 'approved')
      .in('type', ['annual', 'sick'])
      .order('decided_at', { ascending: false }),
  ]);

  if (fe) return NextResponse.json({ error: fe.message }, { status: 500 });
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 });

  const addresses = mapForwardRows(forwardRows as { id: string; email: string; send_enabled: boolean }[] | null);

  const requestsOut = (approvalRows || []).map((row) => {
    const u = row.users as { name?: string } | { name?: string }[] | null;
    const p = row.projects as { name?: string } | { name?: string }[] | null;
    const employeeName = Array.isArray(u) ? u[0]?.name : u?.name;
    const projectName = Array.isArray(p) ? p[0]?.name : p?.name;
    const forwardSentAt = row.approval_forward_sent_at as string | null;
    return {
      id: row.id as string,
      startDate: row.start_date as string,
      endDate: row.end_date as string,
      type: row.type as string,
      typeLabel: formatLeaveTypeLabel(row.type as string),
      workingDays: Number(row.working_days_count ?? 0),
      decidedAt: row.decided_at as string | null,
      forwardSentAt,
      forwardSent: Boolean(forwardSentAt),
      employeeName: employeeName || '—',
      projectName: projectName || '—',
    };
  });

  return NextResponse.json({ addresses, requests: requestsOut, pending: requestsOut.filter((r) => !r.forwardSent) });
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

  const normalized: { email: string; sendEnabled: boolean }[] = [];
  const seen = new Set<string>();

  for (const row of parsed.data.addresses) {
    const t = row.email.trim().toLowerCase();
    if (!t) continue;
    const r = z.string().email().safeParse(t);
    if (!r.success) {
      return NextResponse.json({ error: `Invalid email: ${row.email.trim()}` }, { status: 400 });
    }
    if (seen.has(r.data)) continue;
    seen.add(r.data);
    normalized.push({ email: r.data, sendEnabled: row.sendEnabled });
  }

  const { error: delErr } = await supabase
    .from('user_leave_approval_forward_emails')
    .delete()
    .eq('user_id', user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (normalized.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from('user_leave_approval_forward_emails')
      .insert(
        normalized.map((row) => ({
          user_id: user.id,
          email: row.email,
          send_enabled: row.sendEnabled,
        }))
      )
      .select('id, email, send_enabled');

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({
      addresses: mapForwardRows(inserted as { id: string; email: string; send_enabled: boolean }[]),
    });
  }

  return NextResponse.json({ addresses: [] });
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

  const { count: enabledCount, error: fcErr } = await supabase
    .from('user_leave_approval_forward_emails')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('send_enabled', true);

  if (fcErr) return NextResponse.json({ error: fcErr.message }, { status: 500 });
  if (!enabledCount) {
    return NextResponse.json(
      { error: 'Enable at least one forwarding address and save before sending.' },
      { status: 400 }
    );
  }

  const { data: rows, error } = await supabase
    .from('leave_requests')
    .select('id, approval_forward_sent_at')
    .in('id', parsed.data.requestIds)
    .eq('decided_by', user.id)
    .eq('status', 'approved')
    .in('type', ['annual', 'sick']);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rowById = new Map((rows || []).map((r) => [r.id as string, r]));
  const invalid = parsed.data.requestIds.filter((id) => !rowById.has(id));
  if (invalid.length > 0) {
    return NextResponse.json(
      {
        error: 'Some requests are not eligible (must be annual/sick and approved by you).',
      },
      { status: 400 }
    );
  }

  const service = createServiceClient();
  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const id of parsed.data.requestIds) {
    const row = rowById.get(id);
    const r = await sendLeaveApprovalForwardCopies(service, {
      approverUserId: user.id,
      leaveRequestId: id,
      resend: Boolean(row?.approval_forward_sent_at),
    });
    results.push({ id, ok: !r.error, error: r.error || undefined });
  }

  const failed = results.filter((x) => !x.ok);
  return NextResponse.json({ results, failedCount: failed.length });
}
