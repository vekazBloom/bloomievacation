import { createLeaveRequest, previewLeaveRequest, type CreateLeaveRequestInput } from '@/lib/leave/create-request';
import { getUserLeaveBalance } from '@/lib/leave/global-balance';
import { createServiceClient } from '@/lib/supabase/server';
import type { AppSupabase } from '@/lib/supabase/app-client';

export type BotToolContext = {
  userId: string;
  supabase: AppSupabase;
};

export async function listUserProjects(ctx: BotToolContext) {
  const { data } = await ctx.supabase
    .from('project_members')
    .select('role, projects(id, name, is_archived)')
    .eq('user_id', ctx.userId);

  return (data || [])
    .map((row) => {
      const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
      if (!project?.id || project.is_archived) return null;
      return { id: project.id as string, name: project.name as string, role: row.role as string };
    })
    .filter(Boolean);
}

export async function getLeaveBalanceSummary(ctx: BotToolContext) {
  const { data: balance } = await getUserLeaveBalance(ctx.supabase, ctx.userId);
  if (!balance) {
    return { message: 'Nema konfigurisanog stanja godišnjeg odmora.' };
  }
  const annualTotal =
    Number(balance.annual_leave_total ?? 0) + Number(balance.annual_leave_carried_over ?? 0);
  const annualUsed = Number(balance.annual_leave_used ?? 0);
  const sickTotal = Number(balance.sick_leave_total ?? 0);
  const sickUsed = Number(balance.sick_leave_used ?? 0);
  return {
    annualRemaining: Math.max(0, annualTotal - annualUsed),
    annualTotal,
    annualUsed,
    sickRemaining: Math.max(0, sickTotal - sickUsed),
    sickTotal,
    sickUsed,
  };
}

export async function listUserLeaveRequests(ctx: BotToolContext, limit = 5) {
  const { data } = await ctx.supabase
    .from('leave_requests')
    .select('id, type, start_date, end_date, status, working_days_count, projects(name)')
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map((row) => ({
    id: row.id,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    workingDays: row.working_days_count,
    projectName: (row.projects as { name?: string } | null)?.name ?? 'Projekat',
  }));
}

export async function toolPreviewLeaveRequest(ctx: BotToolContext, input: CreateLeaveRequestInput) {
  return previewLeaveRequest(ctx.supabase, ctx.userId, input);
}

export async function toolCreateLeaveRequest(ctx: BotToolContext, input: CreateLeaveRequestInput) {
  return createLeaveRequest(ctx.supabase, ctx.userId, input);
}

export function buildBotToolContext(userId: string): BotToolContext {
  return { userId, supabase: createServiceClient() };
}

export const BOT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_my_projects',
      description: 'Lista projekata na kojima je korisnik član.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_leave_balance',
      description: 'Vraća preostale dane godišnjeg i bolovanja za korisnika.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_my_requests',
      description: 'Lista nedavnih zahtjeva za odsustvo korisnika.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maksimalan broj zahtjeva (default 5)' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'preview_leave_request',
      description:
        'Provjeri i pripremi zahtjev za odsustvo prije slanja. Koristi ISO datume YYYY-MM-DD.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'UUID projekta' },
          type: { type: 'string', enum: ['annual', 'sick', 'religious'] },
          startDate: { type: 'string', description: 'Početni datum YYYY-MM-DD' },
          endDate: { type: 'string', description: 'Završni datum YYYY-MM-DD' },
          reason: { type: 'string', description: 'Razlog (opcionalno)' },
        },
        required: ['projectId', 'type', 'startDate', 'endDate'],
        additionalProperties: false,
      },
    },
  },
];

export async function executeBotTool(
  ctx: BotToolContext,
  name: string,
  args: Record<string, unknown>
) {
  switch (name) {
    case 'list_my_projects':
      return listUserProjects(ctx);
    case 'get_leave_balance':
      return getLeaveBalanceSummary(ctx);
    case 'list_my_requests':
      return listUserLeaveRequests(ctx, typeof args.limit === 'number' ? args.limit : 5);
    case 'preview_leave_request':
      return toolPreviewLeaveRequest(ctx, {
        projectId: String(args.projectId),
        type: args.type as 'annual' | 'sick' | 'religious',
        startDate: String(args.startDate),
        endDate: String(args.endDate),
        reason: args.reason ? String(args.reason) : null,
      });
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
