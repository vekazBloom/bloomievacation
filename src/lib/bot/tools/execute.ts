import {
  previewCancelLeaveRequest,
  previewCarryOverDecision,
  previewInviteUser,
  previewMarkNotificationsRead,
  previewReligiousSelection,
  previewReviewLeaveRequest,
} from '@/lib/bot/actions';
import { previewLeaveRequest, type CreateLeaveRequestInput } from '@/lib/leave/create-request';
import { listAnnualFundDefinitions } from '@/lib/read/annual-funds';
import { getMyCarryOverDecisions } from '@/lib/read/carry-over';
import {
  getNationalHolidaysList,
  getMyReligiousSelections,
  getReligiousHolidayPool,
} from '@/lib/read/holidays';
import {
  listMySentInvitations,
  listProjectPendingInvites,
  searchUsersForInvite,
} from '@/lib/read/invitations';
import { getJiraConfigSummary, getJiraSprintAnalytics, listJiraSprints } from '@/lib/read/jira';
import { getMyLeaveBalance } from '@/lib/read/leave-balance';
import { listMyLeaveRequests, listProjectLeaveRequests } from '@/lib/read/leave-requests';
import { listMyNotifications } from '@/lib/read/notifications';
import {
  getProjectDetailsForUser,
  getProjectMembersForUser,
  getProjectOverviewForUser,
} from '@/lib/read/project-details';
import { listMyProjects } from '@/lib/read/projects';
import { getMyProfile } from '@/lib/read/profile';
import {
  getTeamLeaveInRange,
  getTeamLeaveThisWeek,
  getTeamLeaveToday,
  getVacationOverlap,
  listPendingTeamRequests,
} from '@/lib/read/team-leave';
import type { AppSupabase } from '@/lib/supabase/app-client';
import type { LeaveStatus, LeaveType, ProjectRole } from '@/types/database';

export type BotToolContext = {
  userId: string;
  supabase: AppSupabase;
};

export async function executeBotTool(
  ctx: BotToolContext,
  name: string,
  args: Record<string, unknown>
) {
  const { supabase, userId } = ctx;

  switch (name) {
    case 'get_my_profile':
      return getMyProfile(supabase, userId);
    case 'list_my_notifications':
      return listMyNotifications(
        supabase,
        userId,
        typeof args.limit === 'number' ? args.limit : 20
      );
    case 'list_my_projects': {
      const result = await listMyProjects(supabase, userId);
      return result.projects;
    }
    case 'get_leave_balance':
      return getMyLeaveBalance(supabase, userId);
    case 'list_my_requests': {
      const result = await listMyLeaveRequests(supabase, userId, {
        limit: typeof args.limit === 'number' ? args.limit : 5,
      });
      return result.ok ? result.requests : result;
    }
    case 'list_national_holidays':
      return getNationalHolidaysList(supabase, userId);
    case 'list_religious_holidays':
      return getReligiousHolidayPool(supabase, userId);
    case 'get_my_religious_selections':
      return getMyReligiousSelections(supabase, userId, Number(args.year));
    case 'get_carry_over_decisions':
      return getMyCarryOverDecisions(
        supabase,
        userId,
        args.projectId ? String(args.projectId) : undefined
      );
    case 'list_annual_fund_definitions':
      return listAnnualFundDefinitions(supabase, userId);
    case 'get_project_details':
      return getProjectDetailsForUser(supabase, userId, String(args.projectId));
    case 'get_project_members':
      return getProjectMembersForUser(supabase, userId, String(args.projectId));
    case 'get_project_overview':
      return getProjectOverviewForUser(supabase, userId, String(args.projectId));
    case 'list_project_requests':
      return listProjectLeaveRequests(supabase, userId, String(args.projectId), {
        status: args.status as LeaveStatus | undefined,
        limit: typeof args.limit === 'number' ? args.limit : 20,
      });
    case 'get_team_on_leave':
      return getTeamLeaveInRange(
        supabase,
        userId,
        String(args.projectId),
        String(args.startDate),
        String(args.endDate),
        {
          includePending: args.includePending === true,
          types: Array.isArray(args.types) ? (args.types as LeaveType[]) : undefined,
        }
      );
    case 'get_team_on_leave_today':
      return getTeamLeaveToday(supabase, userId, String(args.projectId), {
        includePending: args.includePending === true,
      });
    case 'get_team_on_leave_this_week':
      return getTeamLeaveThisWeek(supabase, userId, String(args.projectId), {
        includePending: args.includePending === true,
      });
    case 'get_vacation_overlap':
      return getVacationOverlap(
        supabase,
        userId,
        String(args.projectId),
        String(args.startDate),
        String(args.endDate)
      );
    case 'list_pending_team_requests':
      return listPendingTeamRequests(supabase, userId, {
        projectId: args.projectId ? String(args.projectId) : undefined,
        limit: typeof args.limit === 'number' ? args.limit : 10,
      });
    case 'list_project_invitations':
      return listProjectPendingInvites(supabase, userId, String(args.projectId));
    case 'list_sent_invitations':
      return listMySentInvitations(
        supabase,
        userId,
        typeof args.limit === 'number' ? args.limit : 10
      );
    case 'search_users_for_invite':
      return searchUsersForInvite(
        supabase,
        userId,
        String(args.projectId),
        String(args.query)
      );
    case 'get_jira_config':
      return getJiraConfigSummary(supabase, userId);
    case 'list_jira_sprints':
      return listJiraSprints(
        supabase,
        userId,
        typeof args.boardId === 'number' ? args.boardId : undefined
      );
    case 'get_jira_sprint_analytics':
      return getJiraSprintAnalytics(
        supabase,
        userId,
        Number(args.sprintId),
        typeof args.boardId === 'number' ? args.boardId : undefined
      );
    case 'preview_leave_request':
      return previewLeaveRequest(supabase, userId, {
        projectId: String(args.projectId),
        type: args.type as CreateLeaveRequestInput['type'],
        startDate: String(args.startDate),
        endDate: String(args.endDate),
        reason: args.reason ? String(args.reason) : null,
      });
    case 'preview_review_leave_request':
      return previewReviewLeaveRequest(
        supabase,
        userId,
        String(args.requestId),
        args.action as 'approve' | 'reject',
        args.decisionNote ? String(args.decisionNote) : null
      );
    case 'preview_cancel_leave_request':
      return previewCancelLeaveRequest(supabase, userId, String(args.requestId));
    case 'preview_mark_notifications_read':
      return previewMarkNotificationsRead(supabase, userId);
    case 'preview_religious_selection':
      return previewReligiousSelection(
        supabase,
        userId,
        Number(args.year),
        Array.isArray(args.holidayIds) ? args.holidayIds.map(String) : []
      );
    case 'preview_carry_over_decision':
      return previewCarryOverDecision(
        supabase,
        userId,
        String(args.projectId),
        Number(args.year),
        args.decision as 'transferred' | 'lost'
      );
    case 'preview_invite_user':
      return previewInviteUser(
        supabase,
        userId,
        String(args.projectId),
        String(args.email),
        (args.role as ProjectRole) ?? 'employee'
      );
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
