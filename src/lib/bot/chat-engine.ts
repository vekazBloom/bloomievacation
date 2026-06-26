import {
  createPendingToken,
  type ChatMessage,
  type PendingBotAction,
} from '@/lib/bot/conversation';
import { formatToolResult, READ_ONLY_FORMAT_TOOLS } from '@/lib/bot/formatters';
import { BOT_TOOLS, buildBotToolContext, executeBotTool, listUserProjects } from '@/lib/bot/tools';
import type { CreateLeaveRequestInput } from '@/lib/leave/create-request';
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

export const SYSTEM_PROMPT = `Ti si asistent za BloomieVacation — sistem za zahtjeve za godišnji odmor.
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
- NIKAD ne izmišljaj imena, datume ni brojeve — podaci dolaze isključivo iz alata (baze).

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

export async function processChatMessage(params: {
  userId: string;
  text: string;
  messages: ChatMessage[];
  pendingAction: PendingBotAction | null;
}): Promise<{
  reply: string;
  messages: ChatMessage[];
  pendingAction: PendingBotAction | null;
  pendingChanged: boolean;
}> {
  const { userId, text, pendingAction } = params;
  const history: ChatMessage[] = [...params.messages, { role: 'user', content: text }];

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
  const formattedReadParts: string[] = [];

  for (let step = 0; step < 5 && assistantMessage?.tool_calls?.length; step += 1) {
    openAiMessages.push({
      role: 'assistant',
      content: assistantMessage.content,
      tool_calls: assistantMessage.tool_calls,
    });

    for (const toolCall of assistantMessage.tool_calls) {
      const args = JSON.parse(toolCall.function.arguments || '{}') as Record<string, unknown>;
      const result = await executeBotTool(ctx, toolCall.function.name, args);
      const resultText = JSON.stringify(result);

      if (READ_ONLY_FORMAT_TOOLS.has(toolCall.function.name)) {
        const formatted = formatToolResult(toolCall.function.name, result);
        if (formatted) formattedReadParts.push(formatted);
      }

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
    (formattedReadParts.length > 0 ? formattedReadParts.join('\n\n') : null) ||
    assistantMessage?.content?.trim() ||
    'Nisam uspio obraditi poruku. Pokušajte ponovo s jasnijim pitanjem.';

  newHistory.push({ role: 'assistant', content: replyText });

  return {
    reply: replyText,
    messages: newHistory,
    pendingAction: pending,
    pendingChanged: Boolean(pending && pending.token !== previousToken),
  };
}
