import {
  createPendingToken,
  type ChatMessage,
  type PendingBotAction,
} from '@/lib/bot/conversation';
import { formatToolResult, READ_ONLY_FORMAT_TOOLS } from '@/lib/bot/formatters';
import {
  buildBotToolContext,
  buildBotToolsForUser,
  executeBotTool,
  PREVIEW_TOOL_NAMES,
} from '@/lib/bot/tools';
import type { OpenAITool } from '@/lib/bot/tools/definitions';
import { buildUserContextBlock } from '@/lib/bot/user-context';
import type { CreateLeaveRequestInput } from '@/lib/leave/create-request';
import { createServiceClient } from '@/lib/supabase/server';
import type { ProjectRole } from '@/types/database';

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

export const SYSTEM_PROMPT = `Ti si Bloomie asistent za BloomieVacation — aplikaciju za upravljanje godišnjim odmorom, timom i projektima.
Odgovaraj na hrvatskom/bosanskom/srpskom jeziku.

Što aplikacija nudi:
- Projekti i članovi tima
- Zahtjevi za godišnji, bolovanje i vjerske praznike
- Kalendar odsustva i preklapanje tima
- Državni i vjerski praznici
- Carry-over odluke na kraju godine
- In-app notifikacije
- Pozivnice na projekte (admin)
- Jira analitika (samo system admin)

Opća pravila:
- NIKAD ne izmišljaj podatke — koristi isključivo alate.
- Ne otkrivaj podatke projekata gdje korisnik nije član.
- Poštuj ulogu korisnika — ne nudi admin ili Jira alate ako nisu dostupni.
- Za kompleksne UI akcije (upload doktora, detaljni edit profila) uputi na web aplikaciju.

Godišnji odmor:
- Za kreiranje UVIJEK koristi preview_leave_request, zatim korisnik potvrđuje dugmetom.
- Tipovi: annual = godišnji, sick = bolovanje, religious = vjerski.
- Datume pretvori u YYYY-MM-DD. Godina je ${new Date().getFullYear()} ako korisnik ne navede.
- Za otkazivanje vlastitog zahtjeva koristi preview_cancel_leave_request.

Tim i projekti:
- Za tko je na odmoru: get_team_on_leave, get_team_on_leave_today, get_team_on_leave_this_week.
- Za članove i detalje projekta: get_project_members, get_project_details, get_project_overview.
- Za preklapanje: get_vacation_overlap.

Lead/admin:
- Pending zahtjevi: list_pending_team_requests.
- Odobrenje/odbijanje: preview_review_leave_request + potvrda.
- Lead ne može odobriti vlastiti zahtjev.
- Pozivnice: preview_invite_user (samo admin).

Ostalo:
- Notifikacije: list_my_notifications; označavanje pročitanih: preview_mark_notifications_read.
- Vjerski praznici: list_religious_holidays, get_my_religious_selections; postavljanje: preview_religious_selection.
- Carry-over: get_carry_over_decisions, preview_carry_over_decision.

Budi kratak i jasan.`;

function getOpenAIKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY is not configured');
  return key;
}

async function callOpenAI(messages: OpenAIMessage[], tools: OpenAITool[]) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
      messages,
      tools,
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

function buildPendingFromPreview(
  toolName: string,
  result: unknown,
  userId: string
): PendingBotAction | null {
  if (!result || typeof result !== 'object' || !('ok' in result) || result.ok !== true) {
    return null;
  }

  const token = createPendingToken();
  const createdAt = new Date().toISOString();

  if (toolName === 'preview_review_leave_request') {
    const preview = result as unknown as {
      requestId: string;
      action: 'approve' | 'reject';
      decisionNote: string | null;
      summary: string;
    };
    return {
      kind: 'leave_review',
      token,
      reviewerId: userId,
      requestId: preview.requestId,
      action: preview.action,
      decisionNote: preview.decisionNote,
      summary: preview.summary,
      createdAt,
    };
  }

  if (toolName === 'preview_cancel_leave_request') {
    const preview = result as unknown as { requestId: string; summary: string };
    return {
      kind: 'cancel_leave',
      token,
      userId,
      requestId: preview.requestId,
      summary: preview.summary,
      createdAt,
    };
  }

  if (toolName === 'preview_mark_notifications_read') {
    const preview = result as unknown as { summary: string };
    return {
      kind: 'mark_notifications_read',
      token,
      userId,
      summary: preview.summary,
      createdAt,
    };
  }

  if (toolName === 'preview_religious_selection') {
    const preview = result as unknown as { year: number; holidayIds: string[]; summary: string };
    return {
      kind: 'religious_selection',
      token,
      userId,
      year: preview.year,
      holidayIds: preview.holidayIds,
      summary: preview.summary,
      createdAt,
    };
  }

  if (toolName === 'preview_carry_over_decision') {
    const preview = result as unknown as {
      projectId: string;
      year: number;
      decision: 'transferred' | 'lost';
      summary: string;
    };
    return {
      kind: 'carry_over',
      token,
      userId,
      projectId: preview.projectId,
      year: preview.year,
      decision: preview.decision,
      summary: preview.summary,
      createdAt,
    };
  }

  if (toolName === 'preview_invite_user') {
    const preview = result as unknown as {
      projectId: string;
      email: string;
      role: ProjectRole;
      summary: string;
    };
    return {
      kind: 'invite_user',
      token,
      userId,
      projectId: preview.projectId,
      email: preview.email,
      role: preview.role,
      summary: preview.summary,
      createdAt,
    };
  }

  return null;
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
  const [userContext, tools] = await Promise.all([
    buildUserContextBlock(ctx.supabase, userId),
    buildBotToolsForUser(userId),
  ]);

  const openAiMessages: OpenAIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT + userContext },
    ...history.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
    })),
  ];

  let assistantMessage = await callOpenAI(openAiMessages, tools);
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

      if (PREVIEW_TOOL_NAMES.has(toolCall.function.name)) {
        if (
          toolCall.function.name === 'preview_leave_request' &&
          result &&
          typeof result === 'object' &&
          'ok' in result &&
          result.ok === true
        ) {
          const preview = result as unknown as {
            workingDays: number;
            overlap: { overlapPercent: number; exceedsThreshold: boolean };
            resolvedInput: CreateLeaveRequestInput;
          };
          const projectName = await resolveProjectName(preview.resolvedInput.projectId);
          const summary = formatPreviewSummary(preview.resolvedInput, preview, projectName);
          pending = {
            kind: 'leave_request',
            token: createPendingToken(),
            userId,
            payload: preview.resolvedInput,
            summary,
            createdAt: new Date().toISOString(),
          };
        } else {
          const built = buildPendingFromPreview(toolCall.function.name, result, userId);
          if (built) pending = built;
        }
      }
    }

    assistantMessage = await callOpenAI(openAiMessages, tools);
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
