import { normalizePhoneNumber } from '@/lib/phone/normalize';
import { createServiceClient } from '@/lib/supabase/server';

export async function findUserByPhone(phone: string) {
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from('users')
    .select('id, name, email, phone_number')
    .eq('phone_number', normalized)
    .maybeSingle();

  return data;
}

export async function getTelegramConnectionByChatId(chatId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('telegram_connections')
    .select('id, user_id, telegram_chat_id, is_active, users(id, name, email, phone_number)')
    .eq('telegram_chat_id', chatId)
    .eq('is_active', true)
    .maybeSingle();

  return data;
}

export async function linkTelegramToUser(params: {
  userId: string;
  chatId: string;
  telegramUserId?: string;
}) {
  const supabase = createServiceClient();

  await supabase.from('telegram_connections').update({ is_active: false }).eq('user_id', params.userId);
  await supabase
    .from('telegram_connections')
    .update({ is_active: false })
    .eq('telegram_chat_id', params.chatId);

  const { data, error } = await supabase
    .from('telegram_connections')
    .insert({
      user_id: params.userId,
      telegram_chat_id: params.chatId,
      telegram_user_id: params.telegramUserId ?? null,
      is_active: true,
      linked_at: new Date().toISOString(),
    })
    .select('id, user_id, telegram_chat_id')
    .single();

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, connection: data };
}
