import { NextResponse } from 'next/server';
import { sendInviteReceivedEmail } from '@/lib/email/send';
import { createClient } from '@/lib/supabase/server';

const INVITE_TTL_DAYS = 7;

function nextExpiryIso() {
  const expires = new Date();
  expires.setDate(expires.getDate() + INVITE_TTL_DAYS);
  return expires.toISOString();
}

async function canManageProjectMembers(userId: string, projectId: string) {
  const supabase = createClient();

  const { data: profile } = await supabase
    .from('users')
    .select('is_system_admin')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.is_system_admin) {
    return true;
  }

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .maybeSingle();

  return membership?.role === 'admin';
}

export async function POST(
  _request: Request,
  context: { params: { id: string } }
) {
  const invitationId = context.params.id;
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, email, role, expires_at, accepted_at, project_id')
    .eq('id', invitationId)
    .maybeSingle();

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
  }

  if (invitation.accepted_at) {
    return NextResponse.json({ error: 'Invitation already accepted' }, { status: 409 });
  }

  const allowed = await canManageProjectMembers(user.id, invitation.project_id);
  if (!allowed) {
    return NextResponse.json({ error: 'Only project admins can resend invitations' }, { status: 403 });
  }

  const token = crypto.randomUUID();
  const expiresAt = nextExpiryIso();

  const { data: updatedInvite, error: updateError } = await supabase
    .from('invitations')
    .update({
      token,
      expires_at: expiresAt,
      sent_by: user.id,
    })
    .eq('id', invitation.id)
    .is('accepted_at', null)
    .select('token, expires_at')
    .maybeSingle();

  if (updateError || !updatedInvite) {
    return NextResponse.json(
      { error: updateError?.message || 'Failed to refresh invitation' },
      { status: 500 }
    );
  }

  const { data: inviter } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', invitation.project_id)
    .maybeSingle();

  const emailResult = await sendInviteReceivedEmail({
    to: invitation.email,
    inviterName: inviter?.name || user.email || 'A project admin',
    projectName: project?.name || 'Project',
    role: invitation.role,
    token: updatedInvite.token,
    expiresAt: updatedInvite.expires_at,
  });

  if (!emailResult.success) {
    return NextResponse.json(
      { error: 'Invitation updated, but the email could not be sent' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, expiresAt: updatedInvite.expires_at });
}

