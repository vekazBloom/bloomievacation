import type { AppSupabase } from '@/lib/supabase/app-client';

export type AuthUserEmailState = {
  exists: boolean;
  emailConfirmed: boolean;
  userId?: string;
};

type AuthAdminUser = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};

function mapAuthUserState(user: AuthAdminUser | null | undefined): AuthUserEmailState {
  if (!user?.id) {
    return { exists: false, emailConfirmed: false };
  }
  return {
    exists: true,
    emailConfirmed: Boolean(user.email_confirmed_at),
    userId: user.id,
  };
}

/** Service-role lookup: auth account + whether the user can sign in (email confirmed). */
export async function getAuthUserStateForEmail(
  service: AppSupabase,
  email: string
): Promise<AuthUserEmailState> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return { exists: false, emailConfirmed: false };

  const admin = service.auth.admin as {
    getUserByEmail?: (email: string) => Promise<{
      data: { user: AuthAdminUser | null };
      error: unknown;
    }>;
  };

  if (typeof admin.getUserByEmail === 'function') {
    const { data, error } = await admin.getUserByEmail(normalized);
    if (error) return { exists: false, emailConfirmed: false };
    return mapAuthUserState(data?.user);
  }

  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data?.users) return { exists: false, emailConfirmed: false };
  const user = data.users.find((u) => u.email?.trim().toLowerCase() === normalized);
  return mapAuthUserState(user);
}

/** Service-role lookup: whether an auth user already exists for this email. */
export async function authUserExistsForEmail(
  service: AppSupabase,
  email: string
): Promise<boolean> {
  const state = await getAuthUserStateForEmail(service, email);
  return state.exists;
}
