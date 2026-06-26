import type {
  PendingBotAction,
  PendingLeaveRequest,
  PendingLeaveReview,
} from '@/lib/bot/conversation';
import {
  confirmCancelLeaveRequest,
  confirmCarryOverDecision,
  confirmInviteUser,
  confirmMarkNotificationsRead,
  confirmReligiousSelection,
} from '@/lib/bot/actions';
import { buildBotToolContext } from '@/lib/bot/tools';
import { createLeaveRequest } from '@/lib/leave/create-request';
import { reviewLeaveRequest } from '@/lib/leave/review-request';

export type ConfirmActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; status: number };

export type BotActionType = 'confirm' | 'cancel' | 'review_confirm' | 'review_cancel';

export function getConfirmActionForPending(kind: PendingBotAction['kind']): BotActionType {
  return kind === 'leave_review' ? 'review_confirm' : 'confirm';
}

export function getCancelActionForPending(kind: PendingBotAction['kind']): BotActionType {
  return kind === 'leave_review' ? 'review_cancel' : 'cancel';
}

export function isCancelAction(action: BotActionType): boolean {
  return action === 'cancel' || action === 'review_cancel';
}

export function cancelActionMessage(action: BotActionType): string {
  if (action === 'review_cancel') return 'Obrada zahtjeva je otkazana.';
  return 'Akcija je otkazana.';
}

export async function confirmLeaveRequestAction(
  userId: string,
  pending: PendingLeaveRequest
): Promise<ConfirmActionResult> {
  if (pending.userId !== userId) {
    return { ok: false, error: 'Niste ovlašteni za ovu akciju.', status: 403 };
  }

  const ctx = buildBotToolContext(userId);
  const result = await createLeaveRequest(ctx.supabase, userId, pending.payload);

  if (!result.ok) {
    return { ok: false, error: `Zahtjev nije poslan: ${result.error}`, status: result.status };
  }

  return {
    ok: true,
    message: `✅ Zahtjev je poslan i čeka odobrenje.\n\nStatus: pending\nRadni dani: ${result.request?.working_days_count ?? '—'}`,
  };
}

export async function confirmLeaveReviewAction(
  userId: string,
  pending: PendingLeaveReview
): Promise<ConfirmActionResult> {
  if (pending.reviewerId !== userId) {
    return { ok: false, error: 'Niste ovlašteni za ovu akciju.', status: 403 };
  }

  const ctx = buildBotToolContext(userId);
  const result = await reviewLeaveRequest(ctx.supabase, {
    requestId: pending.requestId,
    reviewerId: userId,
    action: pending.action,
    decisionNote: pending.decisionNote,
  });

  if (!result.ok) {
    return { ok: false, error: `Zahtjev nije obrađen: ${result.error}`, status: result.status };
  }

  const label = pending.action === 'approve' ? 'odobren' : 'odbijen';
  return { ok: true, message: `✅ Zahtjev je ${label}.` };
}

export async function confirmPendingAction(
  userId: string,
  pending: PendingBotAction
): Promise<ConfirmActionResult> {
  switch (pending.kind) {
    case 'leave_request':
      return confirmLeaveRequestAction(userId, pending);
    case 'leave_review':
      return confirmLeaveReviewAction(userId, pending);
    case 'cancel_leave':
      if (pending.userId !== userId) {
        return { ok: false, error: 'Niste ovlašteni za ovu akciju.', status: 403 };
      }
      return confirmCancelLeaveRequest(userId, pending.requestId);
    case 'mark_notifications_read':
      if (pending.userId !== userId) {
        return { ok: false, error: 'Niste ovlašteni za ovu akciju.', status: 403 };
      }
      return confirmMarkNotificationsRead(userId);
    case 'religious_selection':
      if (pending.userId !== userId) {
        return { ok: false, error: 'Niste ovlašteni za ovu akciju.', status: 403 };
      }
      return confirmReligiousSelection(userId, pending.year, pending.holidayIds);
    case 'carry_over':
      if (pending.userId !== userId) {
        return { ok: false, error: 'Niste ovlašteni za ovu akciju.', status: 403 };
      }
      return confirmCarryOverDecision(
        userId,
        pending.projectId,
        pending.year,
        pending.decision
      );
    case 'invite_user':
      if (pending.userId !== userId) {
        return { ok: false, error: 'Niste ovlašteni za ovu akciju.', status: 403 };
      }
      return confirmInviteUser(userId, pending.projectId, pending.email, pending.role);
    default:
      return { ok: false, error: 'Nepoznata akcija.', status: 400 };
  }
}
