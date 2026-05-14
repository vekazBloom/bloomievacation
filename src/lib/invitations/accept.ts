import { sendProjectAddedEmail } from '@/lib/email/send';
import { closePendingInvitationsForEmail } from '@/lib/invitations/status';
import { projectPath } from '@/lib/projects/paths';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { ProjectRole } from '@/types/database';

type ServiceClient = AppSupabase;

type InviteRow = {
  id: string;
  email: string;
  project_id: string | null;
  role: ProjectRole;
  grant_system_admin: boolean | null;
  expires_at: string;
  accepted_at: string | null;
  sent_by: string | null;
};

type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
};

export async function fulfillInvitation(
  service: ServiceClient,
  invite: InviteRow,
  user: AuthUser,
  options?: { notify?: boolean }
) {
  if (invite.accepted_at) {
    return { ok: true as const, projectId: invite.project_id, alreadyAccepted: true };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false as const, status: 410, error: 'Invitation expired' };
  }

  if (invite.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    return { ok: false as const, status: 403, error: 'Email mismatch' };
  }

  const grantAdmin = Boolean(invite.grant_system_admin);
  const { data: existingProfile } = await service
    .from('users')
    .select('is_system_admin')
    .eq('id', user.id)
    .maybeSingle();

  const { data: existingMembership } = invite.project_id
    ? await service
        .from('project_members')
        .select('id')
        .eq('project_id', invite.project_id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const isSystemAdmin = Boolean(existingProfile?.is_system_admin) || grantAdmin;

  const { error: userErr } = await service.from('users').upsert(
    {
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
      is_system_admin: isSystemAdmin,
    },
    { onConflict: 'id' }
  );

  if (userErr) {
    return { ok: false as const, status: 500, error: userErr.message };
  }

  if (invite.project_id) {
    const { error: memberErr } = await service.from('project_members').upsert(
      {
        project_id: invite.project_id,
        user_id: user.id,
        role: invite.role,
      },
      { onConflict: 'project_id,user_id' }
    );

    if (memberErr) {
      return { ok: false as const, status: 500, error: memberErr.message };
    }

    const { error: acceptError } = await closePendingInvitationsForEmail(
      service,
      invite.project_id,
      invite.email
    );

    if (acceptError) {
      return { ok: false as const, status: 500, error: acceptError.message };
    }
  } else {
    const { error: acceptError } = await service
      .from('invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id)
      .is('accepted_at', null);

    if (acceptError) {
      return { ok: false as const, status: 500, error: acceptError.message };
    }
  }

  const shouldNotify =
    options?.notify !== false && invite.project_id && !existingMembership;

  if (shouldNotify) {
    const { data: project } = await service
      .from('projects')
      .select('name, slug')
      .eq('id', invite.project_id)
      .maybeSingle();

    if (project?.slug) {
      await service.from('notifications').insert({
        user_id: user.id,
        type: 'project_added',
        title: 'You joined a new project',
        message: `Welcome aboard! You're now part of the team.`,
        link: projectPath(project.slug),
      });

      const { data: inviter } = invite.sent_by
        ? await service.from('users').select('name').eq('id', invite.sent_by).maybeSingle()
        : { data: null };

      const { data: profile } = await service
        .from('users')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();

      await sendProjectAddedEmail({
        to: user.email,
        recipientName: profile?.name || user.email.split('@')[0],
        projectName: project.name,
        addedByName: inviter?.name || 'Your team',
        projectSlug: project.slug,
      });
    }
  }

  return { ok: true as const, projectId: invite.project_id, alreadyAccepted: false };
}

export async function acceptInvitationToken(
  service: ServiceClient,
  token: string,
  user: AuthUser
) {
  const { data: invite, error: inviteErr } = await service
    .from('invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (inviteErr || !invite) {
    return { ok: false as const, status: 404, error: 'Invitation not found' };
  }

  return fulfillInvitation(service, invite, user, { notify: true });
}
