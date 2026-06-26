import type { ChatMessage, PendingLeaveRequest, PendingLeaveReview } from '@/lib/bot/conversation';
import { buildBotToolContext } from '@/lib/bot/tools';
import { createLeaveRequest } from '@/lib/leave/create-request';
import { reviewLeaveRequest } from '@/lib/leave/review-request';

export type ConfirmActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string; status: number };

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

export type BotActionType = 'confirm' | 'cancel' | 'review_confirm' | 'review_cancel';

export function cancelActionMessage(action: BotActionType): string {
  if (action === 'review_cancel') return 'Obrada zahtjeva je otkazana.';
  return 'Zahtjev je otkazan.';
}

export function isCancelAction(action: BotActionType): boolean {
  return action === 'cancel' || action === 'review_cancel';
}
