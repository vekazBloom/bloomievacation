import { NextRequest, NextResponse } from 'next/server';
import type { PendingBotAction } from '@/lib/bot/conversation';
import {
  cancelActionMessage,
  confirmLeaveRequestAction,
  confirmLeaveReviewAction,
  isCancelAction,
  type BotActionType,
} from '@/lib/bot/confirm-action';
import { loadWebConversation, saveWebConversation } from '@/lib/bot/web-conversation';
import { getCurrentUser } from '@/lib/projects/access';

export async function POST(request: NextRequest) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    token?: string;
    action?: BotActionType;
  } | null;

  const token = body?.token;
  const action = body?.action;

  if (!token || !action) {
    return NextResponse.json({ error: 'Nedostaje token ili akcija.' }, { status: 400 });
  }

  const { messages, pendingAction } = await loadWebConversation(user.id);

  if (!pendingAction || pendingAction.token !== token) {
    return NextResponse.json({ error: 'Akcija je istekla. Pošaljite novu poruku.' }, { status: 400 });
  }

  if (isCancelAction(action)) {
    const reply = cancelActionMessage(action);
    const updatedMessages = [...messages, { role: 'assistant' as const, content: reply }];
    await saveWebConversation(user.id, updatedMessages, null);
    return NextResponse.json({ reply, messages: updatedMessages, pendingAction: null });
  }

  let result;
  if (action === 'confirm' && pendingAction.kind === 'leave_request') {
    result = await confirmLeaveRequestAction(user.id, pendingAction);
  } else if (action === 'review_confirm' && pendingAction.kind === 'leave_review') {
    result = await confirmLeaveReviewAction(user.id, pendingAction);
  } else {
    return NextResponse.json({ error: 'Nepoznata akcija.' }, { status: 400 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const updatedMessages = [...messages, { role: 'assistant' as const, content: result.message }];
  await saveWebConversation(user.id, updatedMessages, null);

  return NextResponse.json({
    reply: result.message,
    messages: updatedMessages,
    pendingAction: null satisfies PendingBotAction | null,
  });
}
