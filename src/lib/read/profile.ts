import type { AppSupabase } from '@/lib/supabase/app-client';

export async function getMyProfile(supabase: AppSupabase, userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, name, email, avatar_url, phone_number, is_system_admin, email_notifications_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (error) return { ok: false as const, error: error.message, status: 500 };
  if (!data) return { ok: false as const, error: 'Profil nije pronađen.', status: 404 };

  return {
    ok: true as const,
    profile: {
      id: data.id,
      name: data.name,
      email: data.email,
      phoneNumber: data.phone_number,
      isSystemAdmin: Boolean(data.is_system_admin),
      emailNotificationsEnabled: Boolean(data.email_notifications_enabled),
    },
  };
}
