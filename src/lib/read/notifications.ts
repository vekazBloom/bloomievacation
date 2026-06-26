import type { AppSupabase } from '@/lib/supabase/app-client';

export async function listMyNotifications(supabase: AppSupabase, userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, title, message, link, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { ok: false as const, error: error.message, status: 500 };

  const notifications = (data || []).map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
    isUnread: !row.read_at,
  }));

  return {
    ok: true as const,
    notifications,
    unreadCount: notifications.filter((n) => n.isUnread).length,
  };
}
