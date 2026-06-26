import { NextRequest, NextResponse } from 'next/server';
import { processChatMessage } from '@/lib/bot/chat-engine';
import { loadWebConversation, saveWebConversation } from '@/lib/bot/web-conversation';
import { getCurrentUser } from '@/lib/projects/access';

export async function POST(request: NextRequest) {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: 'Poruka je prazna.' }, { status: 400 });
  }

  try {
    const { messages, pendingAction } = await loadWebConversation(user.id);
    const result = await processChatMessage({
      userId: user.id,
      text,
      messages,
      pendingAction,
    });

    await saveWebConversation(user.id, result.messages, result.pendingAction);

    return NextResponse.json({
      reply: result.reply,
      messages: result.messages,
      pendingAction: result.pendingAction,
      pendingChanged: result.pendingChanged,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Greška pri obradi poruke.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
