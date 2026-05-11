import { fulfillInvitation } from '@/lib/invitations/accept';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { ProjectRole } from '@/types/database';

type ServiceClient = AppSupabase;

export async function closePendingInvitationsForEmail(
  service: ServiceClient,
  projectId: string,
  email: string
) {
  const normalizedEmail = email.trim().toLowerCase();

  return service
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .ilike('email', normalizedEmail)
    .is('accepted_at', null);
}

export async function reconcileAcceptedInvitationMemberships(
  service: ServiceClient,
  projectId: string
) {
  const { data: acceptedInvites, error } = await service
    .from('invitations')
    .select('email, role')
    .eq('project_id', projectId)
    .not('accepted_at', 'is', null);

  if (error) {
    return { error };
  }

  for (const invite of acceptedInvites || []) {
    const { data: invitedUser } = await service
      .from('users')
      .select('id')
      .ilike('email', invite.email.trim())
      .maybeSingle();

    if (!invitedUser) {
      continue;
    }

    const { error: memberError } = await service.from('project_members').upsert(
      {
        project_id: projectId,
        user_id: invitedUser.id,
        role: invite.role as ProjectRole,
      },
      { onConflict: 'project_id,user_id' }
    );

    if (memberError) {
      return { error: memberError };
    }
  }

  return { error: null };
}

export async function syncInvitationsForUser(
  service: ServiceClient,
  user: { id: string; email: string; name?: string | null }
) {
  const email = user.email.trim();
  if (!email) {
    return { error: null };
  }

  const { data: pendingInvites, error: pendingError } = await service
    .from('invitations')
    .select('*')
    .ilike('email', email)
    .is('accepted_at', null);

  if (pendingError) {
    return { error: pendingError };
  }

  for (const invite of pendingInvites || []) {
    if (new Date(invite.expires_at) < new Date()) {
      continue;
    }

    const result = await fulfillInvitation(service, invite, user, { notify: false });
    if (!result.ok) {
      return { error: new Error(result.error) };
    }
  }

  return reconcileAcceptedInvitationsForUser(service, user.id, email);
}

export async function reconcileAcceptedInvitationsForUser(
  service: ServiceClient,
  userId: string,
  email: string
) {
  const { data: acceptedInvites, error } = await service
    .from('invitations')
    .select('project_id, role')
    .ilike('email', email.trim())
    .not('accepted_at', 'is', null);

  if (error) {
    return { error };
  }

  for (const invite of acceptedInvites || []) {
    const { error: memberError } = await service.from('project_members').upsert(
      {
        project_id: invite.project_id,
        user_id: userId,
        role: invite.role as ProjectRole,
      },
      { onConflict: 'project_id,user_id' }
    );

    if (memberError) {
      return { error: memberError };
    }
  }

  return { error: null };
}
