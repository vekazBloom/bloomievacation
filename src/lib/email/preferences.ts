import type { AppSupabase } from '@/lib/supabase/app-client';

type ServiceClient = AppSupabase;

export async function shouldSendEmail(service: ServiceClient, userId: string) {
  const { data } = await service
    .from('users')
    .select('email_notifications_enabled')
    .eq('id', userId)
    .maybeSingle();

  if (!data) return true;
  return data.email_notifications_enabled !== false;
}
