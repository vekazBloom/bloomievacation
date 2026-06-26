import {
  persistentMessagesOnly,
  type ChatMessage,
  type PendingBotAction,
  type PendingLeaveRequest,
} from '@/lib/bot/conversation';
import { createServiceClient } from '@/lib/supabase/server';

const MAX_MESSAGES = 24;

function normalizePending(raw: unknown): PendingBotAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj.kind === 'leave_review' || obj.kind === 'leave_request') {
    return obj as PendingBotAction;
  }
  if (obj.token && obj.userId && obj.payload) {
    return { ...(obj as Omit<PendingLeaveRequest, 'kind'>), kind: 'leave_request' };
  }
  return null;
}

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
