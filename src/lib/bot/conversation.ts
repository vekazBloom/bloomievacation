import { createServiceClient } from '@/lib/supabase/server';
import type { CreateLeaveRequestInput } from '@/lib/leave/create-request';
import type { ReviewLeaveAction } from '@/lib/leave/review-request';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
};

export type PendingLeaveRequest = {
  kind: 'leave_request';
  token: string;
  userId: string;
  payload: CreateLeaveRequestInput;
  summary: string;
  createdAt: string;
};

export type PendingLeaveReview = {
  kind: 'leave_review';
  token: string;
  reviewerId: string;
  requestId: string;
  action: ReviewLeaveAction;
  decisionNote: string | null;
  summary: string;
  createdAt: string;
};

export type PendingBotAction = PendingLeaveRequest | PendingLeaveReview;

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

export async function loadConversation(chatId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('bot_conversations')
    .select('messages, pending_request')
    .eq('telegram_chat_id', chatId)
    .maybeSingle();

  const pending = normalizePending(data?.pending_request);

  return {
    messages: (data?.messages as ChatMessage[] | null) ?? [],
    pendingAction: pending,
    /** @deprecated use pendingAction */
    pendingRequest: pending?.kind === 'leave_request' ? pending : null,
  };
}

export async function saveConversation(
  chatId: string,
  messages: ChatMessage[],
  pendingAction: PendingBotAction | null
) {
  const supabase = createServiceClient();
  const trimmed = messages.slice(-MAX_MESSAGES);
  await supabase.from('bot_conversations').upsert(
    {
      telegram_chat_id: chatId,
      messages: trimmed,
      pending_request: pendingAction,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_chat_id' }
  );
}

export function createPendingToken() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}
