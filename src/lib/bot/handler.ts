import {
  createPendingToken,
  loadConversation,
  saveConversation,
  type ChatMessage,
  type PendingBotAction,
  type PendingLeaveRequest,
  type PendingLeaveReview,
} from '@/lib/bot/conversation';
import { BOT_TOOLS, buildBotToolContext, executeBotTool, listUserProjects } from '@/lib/bot/tools';
import {
  createLeaveRequest,
  type CreateLeaveRequestInput,
} from '@/lib/leave/create-request';
import { reviewLeaveRequest } from '@/lib/leave/review-request';
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
import { createServiceClient } from '@/lib/supabase/server';

type OpenAIMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
};

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

const SYSTEM_PROMPT = `Ti si asistent za BloomieVacation — sistem za zahtjeve za godišnji odmor.
Odgovaraj na hrvatskom/bosanskom/srpskom jeziku.

Pravila za vlastite zahtjeve:
- Za kreiranje zahtjeva UVIJEK prvo pozovi preview_leave_request.
- Nikad ne šalješ zahtjev direktno — nakon uspješnog preview-a reci korisniku da potvrdi dugmetom.
- Tipovi: annual = godišnji odmor, sick = bolovanje, religious = vjerski praznik.
- Datume pretvori u ISO format YYYY-MM-DD. Godina je ${new Date().getFullYear()} ako korisnik ne navede.
- Ako korisnik ima jedan projekat, koristi taj projectId bez pitanja.
- Za bolovanje s doktorovom potvrdom uputi korisnika na web aplikaciju.

Pravila za tim (svi članovi projekta):
- Za pitanja tko je na odmoru koristi get_team_on_leave, get_team_on_leave_today ili get_team_on_leave_this_week.
- Za postotak preklapanja tima na godišnjem koristi get_vacation_overlap.
- Ne otkrivaj podatke projekata gdje korisnik nije član.
- Formatiraj odgovor kao kratku listu imena i datuma (bez UUID-ova).

Pravila za lead/admin:
- Za pending zahtjeve koristi list_pending_team_requests.
- Za odobrenje/odbijanje UVIJEK koristi preview_review_leave_request, zatim korisnik potvrđuje dugmetom.
- Lead ne može odobriti vlastiti zahtjev.

Budi kratak i jasan.`;

function getOpenAIKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  return key;
}

async function callOpenAI(messages: OpenAIMessage[]) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      messages,
      tools: BOT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: OpenAIMessage }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || 'OpenAI request failed');
  }

  return payload.choices?.[0]?.message;
}

function formatPreviewSummary(
  input: CreateLeaveRequestInput,
  preview: {
    workingDays: number;
    overlap: { overlapPercent: number; exceedsThreshold: boolean };
  },
  projectName: string
) {
  const typeLabel =
    input.type === 'annual' ? 'Godišnji' : input.type === 'sick' ? 'Bolovanje' : 'Vjerski';
  let text = `${typeLabel} odmor\n`;
  text += `Projekat: ${projectName}\n`;
  text += `Od: ${input.startDate} do ${input.endDate}\n`;
  text += `Radni dani: ${preview.workingDays}\n`;
  if (input.reason) text += `Razlog: ${input.reason}\n`;
  if (preview.overlap.exceedsThreshold) {
    text += `\n⚠️ Upozorenje: ${preview.overlap.overlapPercent}% tima je već na odmoru u tom periodu.`;
  }
  return text;
}

async function resolveProjectName(projectId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase.from('projects').select('name').eq('id', projectId).maybeSingle();
  return data?.name ?? 'Projekat';
}

async function buildProjectContext(ctx: ReturnType<typeof buildBotToolContext>) {
  const projects = await listUserProjects(ctx);
  if (projects.length === 0) return '\n\nKorisnik nema aktivnih projekata.';
  const lines = projects.map((p) => `- ${p.name} (${p.role}): ${p.projectId}`);
  return `\n\nProjekti korisnika (koristi projectId):\n${lines.join('\n')}`;
}

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
  const history: ChatMessage[] = [...messages, { role: 'user', content: text }];

  const ctx = buildBotToolContext(userId);
  const projectContext = await buildProjectContext(ctx);

  const openAiMessages: OpenAIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT + projectContext },
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
    })),
  ];

  let assistantMessage = await callOpenAI(openAiMessages);
  let pending: PendingBotAction | null = pendingAction;
  const previousToken = pending?.token ?? null;
  const newHistory: ChatMessage[] = [...history];

  for (let step = 0; step < 5 && assistantMessage?.tool_calls?.length; step += 1) {
    newHistory.push({
      role: 'assistant',
      content: assistantMessage.content || '',
    });

    openAiMessages.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls,
    });

    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
      const result = await executeBotTool(ctx, toolCall.function.name, args);
      const resultText = JSON.stringify(result);

      newHistory.push({
        role: 'tool',
        content: resultText,
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
      });

      openAiMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: resultText,
      });

      if (
        toolCall.function.name === 'preview_leave_request' &&
        result &&
        typeof result === 'object' &&
        'ok' in result &&
        result.ok === true
      ) {
        const preview = result as {
          ok: true;
          workingDays: number;
          overlap: { overlapPercent: number; exceedsThreshold: boolean };
          resolvedInput: CreateLeaveRequestInput;
        };
        const projectName = await resolveProjectName(preview.resolvedInput.projectId);
        const summary = formatPreviewSummary(preview.resolvedInput, preview, projectName);
        const token = createPendingToken();
        pending = {
          kind: 'leave_request',
          token,
          userId,
          payload: preview.resolvedInput,
          summary,
          createdAt: new Date().toISOString(),
        };
      }

      if (
        toolCall.function.name === 'preview_review_leave_request' &&
        result &&
        typeof result === 'object' &&
        'ok' in result &&
        result.ok === true
      ) {
        const preview = result as {
          ok: true;
          requestId: string;
          action: 'approve' | 'reject';
          decisionNote: string | null;
          summary: string;
        };
        const token = createPendingToken();
        pending = {
          kind: 'leave_review',
          token,
          reviewerId: userId,
          requestId: preview.requestId,
          action: preview.action,
          decisionNote: preview.decisionNote,
          summary: preview.summary,
          createdAt: new Date().toISOString(),
        };
      }
    }

    assistantMessage = await callOpenAI(openAiMessages);
  }

  const replyText =
    assistantMessage?.content?.trim() ||
    'Nisam uspio obraditi poruku. Pokušajte ponovo s jasnijim pitanjem.';

  newHistory.push({ role: 'assistant', content: replyText });
  await saveConversation(chatId, newHistory, pending);

  if (pending && pending.token !== previousToken) {
    const keyboard =
      pending.kind === 'leave_review'
        ? confirmReviewKeyboard(pending.token)
        : confirmLeaveKeyboard(pending.token);
    await sendTelegramMessage(chatId, `${replyText}\n\n${pending.summary}`, {
      replyMarkup: keyboard,
    });
  } else {
    await sendTelegramMessage(chatId, replyText);
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

  if (action === 'cancel') {
    await saveConversation(chatId, messages, null);
    await sendTelegramMessage(chatId, 'Zahtjev je otkazan.');
    return;
  }

  if (action === 'review_cancel') {
    await saveConversation(chatId, messages, null);
    await sendTelegramMessage(chatId, 'Obrada zahtjeva je otkazana.');
    return;
  }

  if (action === 'confirm' && pendingAction.kind === 'leave_request') {
    await handleConfirmLeaveRequest(chatId, messages, pendingAction);
    return;
  }

  if (action === 'review_confirm' && pendingAction.kind === 'leave_review') {
    await handleConfirmLeaveReview(chatId, messages, pendingAction);
    return;
  }

  await sendTelegramMessage(chatId, 'Nepoznata akcija.');
}

async function handleConfirmLeaveRequest(
  chatId: string,
  messages: ChatMessage[],
  pending: PendingLeaveRequest
) {
  const connection = await getTelegramConnectionByChatId(chatId);
  if (!connection?.user_id || connection.user_id !== pending.userId) {
    await sendTelegramMessage(chatId, 'Niste ovlašteni za ovu akciju.');
    return;
  }

  const ctx = buildBotToolContext(connection.user_id);
  const result = await createLeaveRequest(ctx.supabase, connection.user_id, pending.payload);
  await saveConversation(chatId, messages, null);

  if (!result.ok) {
    await sendTelegramMessage(chatId, `Zahtjev nije poslan: ${result.error}`);
    return;
  }

  await sendTelegramMessage(
    chatId,
    `✅ Zahtjev je poslan i čeka odobrenje.\n\nStatus: pending\nRadni dani: ${result.request?.working_days_count ?? '—'}`
  );
}

async function handleConfirmLeaveReview(
  chatId: string,
  messages: ChatMessage[],
  pending: PendingLeaveReview
) {
  const connection = await getTelegramConnectionByChatId(chatId);
  if (!connection?.user_id || connection.user_id !== pending.reviewerId) {
    await sendTelegramMessage(chatId, 'Niste ovlašteni za ovu akciju.');
    return;
  }

  const ctx = buildBotToolContext(connection.user_id);
  const result = await reviewLeaveRequest(ctx.supabase, {
    requestId: pending.requestId,
    reviewerId: connection.user_id,
    action: pending.action,
    decisionNote: pending.decisionNote,
  });
  await saveConversation(chatId, messages, null);

  if (!result.ok) {
    await sendTelegramMessage(chatId, `Zahtjev nije obrađen: ${result.error}`);
    return;
  }

  const label = pending.action === 'approve' ? 'odobren' : 'odbijen';
  await sendTelegramMessage(chatId, `✅ Zahtjev je ${label}.`);
}
