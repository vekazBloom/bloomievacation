import {
  loadConversation,
  saveConversation,
  type ChatMessage,
  type PendingLeaveRequest,
  type PendingLeaveReview,
} from '@/lib/bot/conversation';
import { processChatMessage } from '@/lib/bot/chat-engine';
import {
  cancelActionMessage,
  confirmLeaveRequestAction,
  confirmLeaveReviewAction,
  isCancelAction,
  type BotActionType,
} from '@/lib/bot/confirm-action';
import { absoluteAppUrl } from '@/lib/email/app-url';
import {
  answerCallbackQuery,
  confirmLeaveKeyboard,
  confirmReviewKeyboard,
  contactRequestKeyboard,
  sendRemoveKeyboard,
  sendTelegramMessage,
} from '@/lib/telegram/client';
import { findUserByPhone, getTelegramConnectionByChatId, linkTelegramToUser } from '@/lib/telegram/link';

type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number };
    text?: string;
    contact?: { phone_number: string; user_id?: number };
  };
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number } };
    from?: { id: number };
  };
};

export async function handleTelegramUpdate(update: TelegramUpdate) {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }

  const message = update.message;
  if (!message?.chat?.id) return;

  const chatId = String(message.chat.id);

  if (message.contact?.phone_number) {
    await handleContactShare(chatId, message.contact.phone_number, message.from?.id);
    return;
  }

  const text = message.text?.trim();
  if (!text) return;

  if (text === '/start') {
    await handleStart(chatId);
    return;
  }

  const connection = await getTelegramConnectionByChatId(chatId);
  if (!connection?.user_id) {
    await sendTelegramMessage(
      chatId,
      `Niste povezani. Prvo dodajte broj telefona na ${absoluteAppUrl('/profile')}, zatim podijelite kontakt ovdje.`,
      { replyMarkup: contactRequestKeyboard() }
    );
    return;
  }

  await handleChatMessage(chatId, connection.user_id, text);
}

async function handleStart(chatId: string) {
  const connection = await getTelegramConnectionByChatId(chatId);
  if (connection?.user_id) {
    const name = (connection.users as { name?: string } | null)?.name ?? 'korisnik';
    await sendTelegramMessage(
      chatId,
      `Pozdrav ${name}! Već ste povezani.\n\nMožete pisati npr:\n"Tko je na godišnjem ovaj tjedan?"\n"Želim godišnji odmor od 14. augusta do 25. augusta"`
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    `Dobrodošli u BloomieVacation bot!\n\n1. Dodajte broj telefona na ${absoluteAppUrl('/profile')}\n2. Podijelite kontakt ispod da povežemo račun.`,
    { replyMarkup: contactRequestKeyboard() }
  );
}

async function handleContactShare(chatId: string, phone: string, telegramUserId?: number) {
  const user = await findUserByPhone(phone);
  if (!user) {
    await sendTelegramMessage(
      chatId,
      `Broj ${phone} nije pronađen u sistemu.\n\nDodajte isti broj na ${absoluteAppUrl('/profile')}, spremite, pa ponovo podijelite kontakt.`,
      { replyMarkup: contactRequestKeyboard() }
    );
    return;
  }

  const link = await linkTelegramToUser({
    userId: user.id,
    chatId,
    telegramUserId: telegramUserId ? String(telegramUserId) : undefined,
  });

  if (!link.ok) {
    await sendTelegramMessage(chatId, `Povezivanje nije uspjelo: ${link.error}`);
    return;
  }

  await sendRemoveKeyboard(
    chatId,
    `Povezani ste kao ${user.name}.\n\nSada možete slobodno pisati, npr:\n"Tko je na godišnjem ovaj tjedan?"`
  );
}

async function handleChatMessage(chatId: string, userId: string, text: string) {
  const { messages, pendingAction } = await loadConversation(chatId);

  const result = await processChatMessage({
    userId,
    text,
    messages,
    pendingAction,
  });

  await saveConversation(chatId, result.messages, result.pendingAction);

  const pending = result.pendingAction;
  if (pending && result.pendingChanged) {
    const keyboard =
      pending.kind === 'leave_review'
        ? confirmReviewKeyboard(pending.token)
        : confirmLeaveKeyboard(pending.token);
    await sendTelegramMessage(chatId, `${result.reply}\n\n${pending.summary}`, {
      replyMarkup: keyboard,
    });
  } else {
    await sendTelegramMessage(chatId, result.reply);
  }
}

async function handleCallback(callback: NonNullable<TelegramUpdate['callback_query']>) {
  const chatId = String(callback.message?.chat.id ?? '');
  const data = callback.data ?? '';
  if (!chatId || !data) return;

  await answerCallbackQuery(callback.id);

  const [action, token] = data.split(':');
  const { pendingAction, messages } = await loadConversation(chatId);

  if (!pendingAction || pendingAction.token !== token) {
    await sendTelegramMessage(chatId, 'Akcija je istekla. Pošaljite novu poruku.');
    return;
  }

  const connection = await getTelegramConnectionByChatId(chatId);
  if (!connection?.user_id) {
    await sendTelegramMessage(chatId, 'Niste povezani.');
    return;
  }

  const botAction = action as BotActionType;

  if (isCancelAction(botAction)) {
    await saveConversation(chatId, messages, null);
    await sendTelegramMessage(chatId, cancelActionMessage(botAction));
    return;
  }

  if (botAction === 'confirm' && pendingAction.kind === 'leave_request') {
    await handleConfirmLeaveRequest(chatId, messages, connection.user_id, pendingAction);
    return;
  }

  if (botAction === 'review_confirm' && pendingAction.kind === 'leave_review') {
    await handleConfirmLeaveReview(chatId, messages, connection.user_id, pendingAction);
    return;
  }

  await sendTelegramMessage(chatId, 'Nepoznata akcija.');
}

async function handleConfirmLeaveRequest(
  chatId: string,
  messages: ChatMessage[],
  userId: string,
  pending: PendingLeaveRequest
) {
  const result = await confirmLeaveRequestAction(userId, pending);
  await saveConversation(chatId, messages, null);

  if (!result.ok) {
    await sendTelegramMessage(chatId, result.error);
    return;
  }

  await sendTelegramMessage(chatId, result.message);
}

async function handleConfirmLeaveReview(
  chatId: string,
  messages: ChatMessage[],
  userId: string,
  pending: PendingLeaveReview
) {
  const result = await confirmLeaveReviewAction(userId, pending);
  await saveConversation(chatId, messages, null);

  if (!result.ok) {
    await sendTelegramMessage(chatId, result.error);
    return;
  }

  await sendTelegramMessage(chatId, result.message);
}
