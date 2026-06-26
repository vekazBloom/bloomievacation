import { NextRequest, NextResponse } from 'next/server';
import { handleTelegramUpdate } from '@/lib/bot/handler';

export const dynamic = 'force-dynamic';

function verifyTelegramSecret(request: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const header = request.headers.get('x-telegram-bot-api-secret-token');
  return header === secret;
}

export async function POST(request: NextRequest) {
  if (!verifyTelegramSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) {
    return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 503 });
  }

  const update = await request.json().catch(() => null);
  if (!update) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  try {
    await handleTelegramUpdate(update);
  } catch (error) {
    console.error('[telegram/webhook]', error);
  }

  return NextResponse.json({ ok: true });
}
