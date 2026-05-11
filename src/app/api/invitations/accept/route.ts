import { NextRequest, NextResponse } from 'next/server';
import { sendProjectAddedEmail } from '@/lib/email/send';
import { closePendingInvitationsForEmail } from '@/lib/invitations/status';
import { createClient, createServiceClient } from '@/lib/supabase/server';

async function acceptInvite(token: string) {
  const supabase = createClient();
  const service = createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: 'Not authenticated' };
  }

  const { data: invite, error: inviteErr } = await service
    .from('invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (inviteErr || !invite) {
    return { ok: false, status: 404, error: 'Invitation not found' };
  }
  if (invite.accepted_at) {
    return { ok: false, status: 410, error: 'Invitation already used' };
  }
  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false, status: 410, error: 'Invitation expired' };
  }
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    return { ok: false, status: 403, error: 'Email mismatch' };
  }

  // Ensure profile row exists.
  await service.from('users').upsert(
    {
      id: user.id,
      email: user.email!,
      name: (user.user_metadata?.name as string) || user.email!.split('@')[0],
    },
    { onConflict: 'id' }
  );

  // Add as project member (idempotent).
  const { error: memberErr } = await service
    .from('project_members')
    .upsert(
      {
        project_id: invite.project_id,
        user_id: user.id,
        role: invite.role,
      },
      { onConflict: 'project_id,user_id' }
    );

  if (memberErr) {
    return { ok: false, status: 500, error: memberErr.message };
  }

  const { error: acceptError } = await closePendingInvitationsForEmail(
    service,
    invite.project_id,
    invite.email
  );

  if (acceptError) {
    return { ok: false, status: 500, error: acceptError.message };
  }

  // Notification.
  await service.from('notifications').insert({
    user_id: user.id,
    type: 'project_added',
    title: 'You joined a new project',
    message: `Welcome aboard! You're now part of the team.`,
    link: `/projects/${invite.project_id}`,
  });

  const { data: project } = await service
    .from('projects')
    .select('name')
    .eq('id', invite.project_id)
    .maybeSingle();

  const { data: inviter } = invite.sent_by
    ? await service.from('users').select('name').eq('id', invite.sent_by).maybeSingle()
    : { data: null };

  const { data: profile } = await service
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  if (user.email && project) {
    await sendProjectAddedEmail({
      to: user.email,
      recipientName: profile?.name || user.email.split('@')[0],
      projectName: project.name,
      addedByName: inviter?.name || 'Your team',
      projectId: invite.project_id,
    });
  }

  return { ok: true, projectId: invite.project_id };
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const redirectPath = request.nextUrl.searchParams.get('redirect') || '/dashboard';
  if (!token) return NextResponse.redirect(new URL('/?error=no-token', request.url));

  const result = await acceptInvite(token);
  if (!result.ok) {
    return NextResponse.redirect(new URL(`/?error=${encodeURIComponent(result.error || 'invite-failed')}`, request.url));
  }
  return NextResponse.redirect(new URL(redirectPath, request.url));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = body?.token;
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const result = await acceptInvite(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, projectId: result.projectId });
}
