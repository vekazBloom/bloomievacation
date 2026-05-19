import type { AppSupabase } from '@/lib/supabase/app-client';

/** Service-role lookup: whether an auth user already exists for this email. */
export async function authUserExistsForEmail(
  service: AppSupabase,
  email: string
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const admin = service.auth.admin as {
    getUserByEmail?: (email: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  };

  if (typeof admin.getUserByEmail === 'function') {
    const { data, error } = await admin.getUserByEmail(normalized);
    if (error) return false;
    return Boolean(data?.user?.id);
  }

  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data?.users) return false;
  return data.users.some((u) => u.email?.trim().toLowerCase() === normalized);
}
