import { format, startOfWeek, endOfWeek } from 'date-fns';
import { previewReviewLeaveRequest } from '@/lib/bot/review-leave';
import { listMyProjects } from '@/lib/read/projects';
import { getMyLeaveBalance } from '@/lib/read/leave-balance';
import { listMyLeaveRequests } from '@/lib/read/leave-requests';
import {
  getTeamLeaveInRange,
  getTeamLeaveThisWeek,
  getTeamLeaveToday,
  getVacationOverlap,
  listPendingTeamRequests,
} from '@/lib/read/team-leave';
import { createLeaveRequest, previewLeaveRequest, type CreateLeaveRequestInput } from '@/lib/leave/create-request';
import { createServiceClient } from '@/lib/supabase/server';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { LeaveType } from '@/types/database';

export type BotToolContext = {
  userId: string;
  supabase: AppSupabase;
};

export async function listUserProjects(ctx: BotToolContext) {
  const result = await listMyProjects(ctx.supabase, ctx.userId);
  return result.projects;
}

export async function getLeaveBalanceSummary(ctx: BotToolContext) {
  const result = await getMyLeaveBalance(ctx.supabase, ctx.userId);
  if (!result.ok) {
    return { message: result.error };
  }
  return result.balance;
}

export async function listUserLeaveRequests(ctx: BotToolContext, limit = 5) {
  const result = await listMyLeaveRequests(ctx.supabase, ctx.userId, { limit });
  if (!result.ok) return result;
  return result.requests;
}

export async function toolPreviewLeaveRequest(ctx: BotToolContext, input: CreateLeaveRequestInput) {
  return previewLeaveRequest(ctx.supabase, ctx.userId, input);
}

export function buildBotToolContext(userId: string): BotToolContext {
  return { userId, supabase: createServiceClient() };
}

export const BOT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_my_projects',
      description: 'Lista projekata na kojima je korisnik član, s ulogom.',
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
      name: 'get_team_on_leave',
      description: 'Tko je na odmoru u timu u zadanom periodu (samo članovi projekta).',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'UUID projekta' },
          startDate: { type: 'string', description: 'YYYY-MM-DD' },
          endDate: { type: 'string', description: 'YYYY-MM-DD' },
          includePending: {
            type: 'boolean',
            description: 'Uključi i pending zahtjeve (default false)',
          },
          types: {
            type: 'array',
            items: { type: 'string', enum: ['annual', 'sick', 'religious'] },
            description: 'Filtriraj po tipu odsustva',
          },
        },
        required: ['projectId', 'startDate', 'endDate'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_team_on_leave_today',
      description: 'Tko je danas na odmoru u timu.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'UUID projekta' },
          includePending: { type: 'boolean' },
        },
        required: ['projectId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_team_on_leave_this_week',
      description: 'Tko je na odmoru ovaj tjedan (pon–ned) u timu.',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'UUID projekta' },
          includePending: { type: 'boolean' },
        },
        required: ['projectId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_vacation_overlap',
      description: 'Koliko članova tima ima odobren godišnji u periodu (overlap %).',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
        },
        required: ['projectId', 'startDate', 'endDate'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_pending_team_requests',
      description: 'Pending zahtjevi koji čekaju odobrenje (samo lead/admin).',
      parameters: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Opcionalno filtriraj po projektu' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'preview_review_leave_request',
      description:
        'Pripremi odobrenje ili odbijanje pending zahtjeva (samo lead/admin). Korisnik mora potvrditi dugmetom.',
      parameters: {
        type: 'object',
        properties: {
          requestId: { type: 'string', description: 'UUID zahtjeva' },
          action: { type: 'string', enum: ['approve', 'reject'] },
          decisionNote: { type: 'string', description: 'Opcionalna napomena' },
        },
        required: ['requestId', 'action'],
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
    case 'get_team_on_leave':
      return getTeamLeaveInRange(
        ctx.supabase,
        ctx.userId,
        String(args.projectId),
        String(args.startDate),
        String(args.endDate),
        {
          includePending: args.includePending === true,
          types: Array.isArray(args.types) ? (args.types as LeaveType[]) : undefined,
        }
      );
    case 'get_team_on_leave_today':
      return getTeamLeaveToday(ctx.supabase, ctx.userId, String(args.projectId), {
        includePending: args.includePending === true,
      });
    case 'get_team_on_leave_this_week':
      return getTeamLeaveThisWeek(ctx.supabase, ctx.userId, String(args.projectId), {
        includePending: args.includePending === true,
      });
    case 'get_vacation_overlap':
      return getVacationOverlap(
        ctx.supabase,
        ctx.userId,
        String(args.projectId),
        String(args.startDate),
        String(args.endDate)
      );
    case 'list_pending_team_requests':
      return listPendingTeamRequests(ctx.supabase, ctx.userId, {
        projectId: args.projectId ? String(args.projectId) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 10,
      });
    case 'preview_review_leave_request':
      return previewReviewLeaveRequest(
        ctx.supabase,
        ctx.userId,
        String(args.requestId),
        args.action as 'approve' | 'reject',
        args.decisionNote ? String(args.decisionNote) : null
      );
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
