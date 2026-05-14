import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { buildInviteRoleSummary } from '@/lib/email/format';
import { sendInviteReceivedEmail } from '@/lib/email/send';
import { getCurrentUser, getUserProfile } from '@/lib/projects/access';
import type { ProjectRole } from '@/types/database';

const schema = z.object({
  email: z.string().email(),
  grantSystemAdmin: z.boolean().optional().default(false),
  projectId: z.string().uuid().optional().nullable(),
  role: z.enum(['admin', 'lead', 'employee']).optional().default('employee'),
});

export async function POST(request: NextRequest) {
  const { supabase, user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const profile = await getUserProfile(user.id);
  if (!profile?.is_system_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { email, grantSystemAdmin, projectId, role } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  let projectName: string | null = null;
  if (projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .maybeSingle();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    projectName = project.name;
  }

  const hasProject = Boolean(projectId);

  const { data: inviter } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: invite, error: inviteError } = await supabase
    .from('invitations')
    .insert({
      email: normalizedEmail,
      project_id: projectId ?? null,
      role: role as ProjectRole,
      grant_system_admin: grantSystemAdmin,
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
    inviterName: inviter?.name || user.email || 'BloomieVacation admin',
    projectName,
    roleSummary: buildInviteRoleSummary({
      projectRole: role,
      grantSystemAdmin,
      hasProject,
    }),
    token: invite.token,
    expiresAt: invite.expires_at,
  });

  if (!emailResult.success) {
    return NextResponse.json(
      { error: 'Invitation created, but the email could not be sent' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
