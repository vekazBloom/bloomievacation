import { createServiceClient } from '@/lib/supabase/server';
import type { CreateLeaveRequestInput } from '@/lib/leave/create-request';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
};

export type PendingLeaveRequest = {
  token: string;
  userId: string;
  payload: CreateLeaveRequestInput;
  summary: string;
  createdAt: string;
};

const MAX_MESSAGES = 24;

export async function loadConversation(chatId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('bot_conversations')
    .select('messages, pending_request')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  return {
    messages: (data?.messages as ChatMessage[] | null) ?? [],
    pendingRequest: (data?.pending_request as PendingLeaveRequest | null) ?? null,
  };
}

export async function saveConversation(
  chatId: string,
  messages: ChatMessage[],
  pendingRequest: PendingLeaveRequest | null
) {
  const supabase = createServiceClient();
  const trimmed = messages.slice(-MAX_MESSAGES);
  await supabase.from('bot_conversations').upsert(
    {
      telegram_chat_id: chatId,
      messages: trimmed,
      pending_request: pendingRequest,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_chat_id' }
  );
}

export function createPendingToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}
