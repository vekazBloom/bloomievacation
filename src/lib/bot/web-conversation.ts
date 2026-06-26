import {
  persistentMessagesOnly,
  normalizePending,
  type ChatMessage,
  type PendingBotAction,
} from '@/lib/bot/conversation';
import { createServiceClient } from '@/lib/supabase/server';

const MAX_MESSAGES = 24;

export async function loadWebConversation(userId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('web_chat_conversations')
    .select('messages, pending_request')
    .eq('user_id', userId)
    .maybeSingle();

  const pending = normalizePending(data?.pending_request);

  return {
    messages: persistentMessagesOnly((data?.messages as ChatMessage[] | null) ?? []),
    pendingAction: pending,
  };
}

export async function saveWebConversation(
  userId: string,
  messages: ChatMessage[],
  pendingAction: PendingBotAction | null
) {
  const supabase = createServiceClient();
  const trimmed = persistentMessagesOnly(messages).slice(-MAX_MESSAGES);
  await supabase.from('web_chat_conversations').upsert(
    {
      user_id: userId,
      messages: trimmed,
      pending_request: pendingAction,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}
