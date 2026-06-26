import { NextResponse } from 'next/server';
import { loadWebConversation } from '@/lib/bot/web-conversation';
import { getCurrentUser } from '@/lib/projects/access';

export async function GET() {
  const { user } = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { messages, pendingAction } = await loadWebConversation(user.id);
  return NextResponse.json({ messages, pendingAction });
}
