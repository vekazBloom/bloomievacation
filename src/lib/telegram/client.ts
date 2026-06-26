const TELEGRAM_API = 'https://api.telegram.org';

export type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  request_contact?: boolean;
};

export type TelegramInlineKeyboard = {
  inline_keyboard: InlineKeyboardButton[][];
};

export type TelegramReplyKeyboard = {
  keyboard: InlineKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
};

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  return token;
}

async function telegramFetch<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = getBotToken();
  const response = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    description?: string;
    result?: T;
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || `Telegram API ${method} failed`);
  }
  return payload.result as T;
}

export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: {
    replyMarkup?: TelegramInlineKeyboard | TelegramReplyKeyboard;
    parseMode?: 'HTML' | 'Markdown';
  }
) {
  return telegramFetch('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode,
    reply_markup: options?.replyMarkup,
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return telegramFetch('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  });
}

export function contactRequestKeyboard(): TelegramReplyKeyboard {
  return {
    keyboard: [[{ text: '📱 Podijeli kontakt', request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function confirmLeaveKeyboard(requestToken: string): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: '✅ Potvrdi', callback_data: `confirm:${requestToken}` },
        { text: '❌ Odustani', callback_data: `cancel:${requestToken}` },
      ],
    ],
  };
}

export function removeKeyboardMarkup() {
  return { remove_keyboard: true };
}

export async function sendRemoveKeyboard(chatId: string | number, text: string) {
  return telegramFetch('sendMessage', {
    chat_id: chatId,
    text,
    reply_markup: { remove_keyboard: true },
  });
}
