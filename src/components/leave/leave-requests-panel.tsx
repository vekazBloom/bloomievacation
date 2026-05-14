'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDateRange } from '@/lib/utils';
import {
  formatAnnualRequestFundsSummary,
  formatLeaveBalancePoolLine,
} from '@/lib/leave/format-annual-request-funds';
import { projectPath } from '@/lib/projects/paths';

export function LeaveRequestsPanel({
  requests,
  canReview,
  projectSlug,
  currentUserId,
}: {
  requests: any[];
  canReview: boolean;
  projectSlug?: string;
  currentUserId?: string;
}) {
  const router = useRouter();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionAction, setDecisionAction] = useState<'reject' | 'approve'>('reject');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editReason, setEditReason] = useState('');

  const pendingCount = requests.filter((request) => request.status === 'pending').length;

  async function updateRequest(
    id: string,
    payload: Record<string, unknown>,
    successMessage: string
  ) {
    const response = await fetch(`/api/leave-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(body.error || 'Failed to update request');
    toast.success(successMessage);
    setRejectingId(null);
    setDecisionNote('');
    setEditingId(null);
    router.refresh();
  }

  async function openAttachment(id: string) {
    const response = await fetch(`/api/leave-requests/${id}/attachment`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return toast.error(payload.error || 'Failed to open attachment');
    window.open(payload.url, '_blank', 'noopener,noreferrer');
  }

  function startEditing(request: any) {
    setEditingId(request.id);
    setEditStartDate(request.start_date);
    setEditEndDate(request.end_date);
    setEditReason(request.reason || '');
  }

  return (
    <div className="space-y-4">
      {canReview && pendingCount > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {pendingCount} pending request{pendingCount === 1 ? '' : 's'} waiting for review.
        </div>
      ) : null}

      <div className="divide-y divide-border rounded-lg border border-border">
        {requests.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">No leave requests yet.</p>
        ) : (
          requests.map((request) => {
            const canCancel =
              request.status === 'pending' &&
              (!currentUserId || request.user_id === currentUserId);
            const canEdit =
              request.status === 'pending' &&
              currentUserId &&
              request.user_id === currentUserId;
            const profileHref =
              projectSlug && request.user_id
                ? projectPath(projectSlug, 'members', request.user_id)
                : null;
            const isEditing = editingId === request.id;
            const isRejecting = rejectingId === request.id;
            const canEditDecision = canReview && (request.status === 'approved' || request.status === 'rejected');

            return (
              <div key={request.id} className="space-y-3 px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    {profileHref ? (
                      <Link href={profileHref} className="font-medium hover:underline">
                        {request.users?.name || 'Employee'}
                      </Link>
                    ) : (
                      <p className="font-medium">{request.users?.name || 'Employee'}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {request.type} · {formatDateRange(request.start_date, request.end_date)} ·{' '}
                      {request.working_days_count} days
                    </p>
                    {request.type === 'annual' ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatAnnualRequestFundsSummary(request.leave_request_grant_allocations)}
                      </p>
                    ) : request.type === 'sick' || request.type === 'religious' ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatLeaveBalancePoolLine(request.type)}
                      </p>
                    ) : null}
                    {request.reason ? (
                      <p className="mt-1 text-sm text-muted-foreground">{request.reason}</p>
                    ) : null}
                    {request.decision_note ? (
                      <p className="mt-1 text-sm text-rose-700">Rejection note: {request.decision_note}</p>
                    ) : null}
                    {request.attachment_url ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="link"
                        className="h-auto px-0"
                        onClick={() => openAttachment(request.id)}
                      >
                        View attachment
                      </Button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="uppercase">
                      {request.status}
                    </Badge>
                    {canReview && request.status === 'pending' && !isRejecting ? (
                      <>
                        <Button size="sm" onClick={() => updateRequest(request.id, { action: 'approve' }, 'Request approved')}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejectingId(request.id);
                            setDecisionNote('');
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {canEditDecision && !isRejecting ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRejectingId(request.id);
                          setDecisionAction(request.status === 'approved' ? 'approve' : 'reject');
                          setDecisionNote(request.decision_note || '');
                        }}
                      >
                        Edit decision
                      </Button>
                    ) : null}
                    {canEdit && !isEditing ? (
                      <Button size="sm" variant="outline" onClick={() => startEditing(request)}>
                        Edit
                      </Button>
                    ) : null}
                    {canCancel ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateRequest(request.id, { action: 'cancel' }, 'Request cancelled')}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>

                {isRejecting ? (
                  <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
                    <label className="text-sm font-medium" htmlFor={`reject-note-${request.id}`}>
                      Decision
                    </label>
                    <select
                      value={decisionAction}
                      onChange={(event) =>
                        setDecisionAction(event.target.value as 'reject' | 'approve')
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="approve">Approve</option>
                      <option value="reject">Reject</option>
                    </select>
                    <label className="text-sm font-medium" htmlFor={`decision-note-${request.id}`}>
                      Decision note
                    </label>
                    <textarea
                      id={`decision-note-${request.id}`}
                      value={decisionNote}
                      onChange={(event) => setDecisionNote(event.target.value)}
                      className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="Optional note for the employee"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateRequest(
                            request.id,
                            { action: decisionAction, decisionNote: decisionNote.trim() || null },
                            decisionAction === 'approve' ? 'Request approved' : 'Request rejected'
                          )
                        }
                      >
                        Save decision
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setRejectingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}

                {isEditing ? (
                  <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-sm font-medium" htmlFor={`edit-start-${request.id}`}>
                        Start date
                      </label>
                      <Input
                        id={`edit-start-${request.id}`}
                        type="date"
                        value={editStartDate}
                        onChange={(event) => setEditStartDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium" htmlFor={`edit-end-${request.id}`}>
                        End date
                      </label>
                      <Input
                        id={`edit-end-${request.id}`}
                        type="date"
                        value={editEndDate}
                        onChange={(event) => setEditEndDate(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-sm font-medium" htmlFor={`edit-reason-${request.id}`}>
                        Reason
                      </label>
                      <textarea
                        id={`edit-reason-${request.id}`}
                        value={editReason}
                        onChange={(event) => setEditReason(event.target.value)}
                        className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2 md:col-span-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          updateRequest(
                            request.id,
                            {
                              startDate: editStartDate,
                              endDate: editEndDate,
                              reason: editReason.trim() || null,
                            },
                            'Request updated'
                          )
                        }
                      >
                        Save changes
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
