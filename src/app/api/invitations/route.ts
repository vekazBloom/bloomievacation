import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendInviteReceivedEmail } from '@/lib/email/send';
import { createClient } from '@/lib/supabase/server';
import type { ProjectRole } from '@/types/database';

const inviteSchema = z.object({
  projectId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'lead', 'employee']).default('employee'),
});

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

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid invitation payload' }, { status: 400 });
  }

  const { projectId, email, role } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const allowed = await canManageProjectMembers(user.id, projectId);
  if (!allowed) {
    return NextResponse.json({ error: 'Only project admins can invite members' }, { status: 403 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('name')
    .eq('id', projectId)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { data: inviter } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: invite, error: inviteError } = await supabase
    .from('invitations')
    .insert({
      email: normalizedEmail,
      project_id: projectId,
      role: role as ProjectRole,
      sent_by: user.id,
    })
    .select('token, expires_at')
    .single();

  if (inviteError || !invite) {
    return NextResponse.json(
      { error: inviteError?.message || 'Failed to create invitation' },
      { status: 500 }
    );
  }

  const emailResult = await sendInviteReceivedEmail({
    to: normalizedEmail,
    inviterName: inviter?.name || user.email || 'A project admin',
    projectName: project.name,
    role,
    token: invite.token,
    expiresAt: invite.expires_at,
  });

  if (!emailResult.success) {
    return NextResponse.json(
      {
        error: 'Invitation created, but the email could not be sent',
        inviteToken: invite.token,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
