import type { NotificationType } from '@/types/database';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { Json } from '@/types/database.generated';

type ServiceClient = AppSupabase;

export async function createInAppNotification(
  supabase: ServiceClient,
  params: {
    userId: string;
    type: NotificationType;
    title: string;
    message?: string;
    link?: string;
    metadata?: Json;
  }
) {
  return supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message ?? null,
    link: params.link ?? null,
    metadata: params.metadata ?? null,
  });
}
