import { getAuthUserStateForEmail } from '@/lib/auth/admin-users';
import type { AppSupabase } from '@/lib/supabase/app-client';

export type InviteSignupInput = {
  token: string;
  email: string;
  password: string;
  name: string;
};

export type InviteSignupResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

type AdminAuth = {
  createUser: (params: {
    email: string;
    password: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, string>;
  }) => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
  updateUserById: (
    id: string,
    params: {
      password?: string;
      email_confirm?: boolean;
      user_metadata?: Record<string, string>;
    }
  ) => Promise<{ error: { message: string } | null }>;
};

async function loadValidInvitation(
  service: AppSupabase,
  token: string,
  normalizedEmail: string
) {
  const { data: invite, error } = await service
    .from('invitations')
    .select('id, email, expires_at, accepted_at')
    .eq('token', token)
    .maybeSingle();

  if (error || !invite) {
    return { ok: false as const, status: 404, error: 'Invitation not found' };
  }

  if (invite.accepted_at) {
    return { ok: false as const, status: 410, error: 'Invitation already used' };
  }

  if (new Date(invite.expires_at) < new Date()) {
    return { ok: false as const, status: 410, error: 'Invitation expired' };
  }

  if (invite.email.trim().toLowerCase() !== normalizedEmail) {
    return { ok: false as const, status: 403, error: 'Email does not match invitation' };
  }

  return { ok: true as const, invite };
}

/** Create or finish an invited user without Supabase confirmation email (invite proves email access). */
export async function completeInviteSignup(
  service: AppSupabase,
  input: InviteSignupInput
): Promise<InviteSignupResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const token = input.token.trim();

  if (!token || !normalizedEmail || !name || input.password.length < 8) {
    return { ok: false, status: 400, error: 'Invalid signup payload' };
  }

  const invitation = await loadValidInvitation(service, token, normalizedEmail);
  if (!invitation.ok) {
    return invitation;
  }

  const authState = await getAuthUserStateForEmail(service, normalizedEmail);
  if (authState.exists && authState.emailConfirmed) {
    return {
      ok: false,
      status: 409,
      error: 'An account with this email already exists. Sign in to accept the invite.',
    };
  }

  const admin = service.auth.admin as unknown as AdminAuth;
  let userId = authState.userId;

  if (!authState.exists) {
    const { data, error } = await admin.createUser({
      email: normalizedEmail,
      password: input.password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error || !data.user?.id) {
      return {
        ok: false,
        status: 500,
        error: error?.message || 'Failed to create account',
      };
    }

    userId = data.user.id;
  } else if (userId) {
    const { error } = await admin.updateUserById(userId, {
      password: input.password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (error) {
      return { ok: false, status: 500, error: error.message || 'Failed to update account' };
    }
  } else {
    return { ok: false, status: 500, error: 'Could not resolve auth user' };
  }

  const { error: profileErr } = await service.from('users').upsert(
    {
      id: userId,
      email: normalizedEmail,
      name,
    },
    { onConflict: 'id' }
  );

  if (profileErr) {
    return { ok: false, status: 500, error: profileErr.message };
  }

  return { ok: true, userId };
}
