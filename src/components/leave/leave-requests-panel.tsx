'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { fundSourceShortLabel } from '@/lib/leave/fund-period-label';
import { formatDateRange } from '@/lib/utils';
import {
  formatAnnualRequestFundsSummary,
  formatLeaveBalancePoolLine,
} from '@/lib/leave/format-annual-request-funds';
import {
  formatSickLeavePoolLabel,
  type SickLeavePoolOption,
} from '@/lib/leave/sick-leave-pools';
import { projectPath } from '@/lib/projects/paths';

type MemberGrantOption = {
  id: string;
  label: string;
  grant_year: number | null;
  source: string;
};

type RequestAllocationRow = {
  grant_id?: string;
  working_days?: number | string | null;
};

function allocationRows(request: { leave_request_grant_allocations?: RequestAllocationRow[] | null }) {
  const raw = request.leave_request_grant_allocations;
  if (!raw?.length) return [];
  return raw.filter((row) => row.grant_id);
}

export function LeaveRequestsPanel({
  requests,
  canReview,
  canEditRequestFunds = false,
  projectId,
  projectSlug,
  currentUserId,
}: {
  requests: any[];
  canReview: boolean;
  canEditRequestFunds?: boolean;
  projectId?: string;
  projectSlug?: string;
  currentUserId?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionAction, setDecisionAction] = useState<'reject' | 'approve'>('reject');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editReason, setEditReason] = useState('');
  const [memberGrants, setMemberGrants] = useState<MemberGrantOption[]>([]);
  const [annualFundGrantId, setAnnualFundGrantId] = useState('');
  const [annualFundSplits, setAnnualFundSplits] = useState<Record<string, string>>({});
  const [sickPools, setSickPools] = useState<SickLeavePoolOption[]>([]);
  const [sickPoolProjectId, setSickPoolProjectId] = useState('');

  const pendingCount = requests.filter((request) => request.status === 'pending').length;
  const decisionRequest = rejectingId ? requests.find((r) => r.id === rejectingId) : null;

  useEffect(() => {
    if (!rejectingId || !canEditRequestFunds || !decisionRequest) {
      setMemberGrants([]);
      setSickPools([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      if (decisionRequest.type === 'annual') {
        const { data, error } = await supabase
          .from('annual_entitlement_grants')
          .select('id, label, grant_year, source')
          .eq('user_id', decisionRequest.user_id)
          .order('valid_from', { ascending: true });

        if (cancelled) return;
        setMemberGrants(error ? [] : ((data || []) as MemberGrantOption[]));
        setSickPools([]);
        return;
      }

      if (decisionRequest.type === 'sick') {
        const { data: memberships, error } = await supabase
          .from('project_members')
          .select('project_id, sick_leave_total, sick_leave_used, projects(name)')
          .eq('user_id', decisionRequest.user_id);

        if (cancelled) return;
        if (error) {
          setSickPools([]);
          setMemberGrants([]);
          return;
        }
        const pools: SickLeavePoolOption[] = (memberships || []).map((row) => {
          const project = row.projects as { name?: string } | { name?: string }[] | null;
          const name = Array.isArray(project) ? project[0]?.name : project?.name;
          const total = Number(row.sick_leave_total ?? 0);
          const used = Number(row.sick_leave_used ?? 0);
          return {
            projectId: row.project_id as string,
            projectName: name || 'Project',
            sickTotal: total,
            sickUsed: used,
            sickRemaining: Math.max(0, total - used),
          };
        });
        setSickPools(pools);
        setMemberGrants([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rejectingId, canEditRequestFunds, decisionRequest, supabase]);

  function resetFundEditor() {
    setAnnualFundGrantId('');
    setAnnualFundSplits({});
    setMemberGrants([]);
    setSickPools([]);
    setSickPoolProjectId('');
  }

  function closeDecisionEditor() {
    setRejectingId(null);
    setDecisionNote('');
    resetFundEditor();
  }

  function openDecisionEditor(
    request: {
    id: string;
    status: string;
    decision_note?: string | null;
    type: string;
    balance_project_id?: string | null;
    leave_request_grant_allocations?: RequestAllocationRow[] | null;
    },
    actionOverride?: 'reject' | 'approve'
  ) {
    setRejectingId(request.id);
    setDecisionAction(actionOverride ?? (request.status === 'approved' ? 'approve' : 'reject'));
    setDecisionNote(request.decision_note || '');

    setSickPoolProjectId((request.balance_project_id as string | null) ?? '');

    const rows = allocationRows(request);
    if (rows.length > 1) {
      setAnnualFundGrantId('__split__');
      const splits: Record<string, string> = {};
      for (const row of rows) {
        if (row.grant_id) splits[row.grant_id] = String(row.working_days ?? '');
      }
      setAnnualFundSplits(splits);
    } else if (rows.length === 1 && rows[0].grant_id) {
      setAnnualFundGrantId(rows[0].grant_id);
      setAnnualFundSplits({});
    } else {
      setAnnualFundGrantId('');
      setAnnualFundSplits({});
    }
  }

  function buildAnnualAllocationsPayload(request: {
    type: string;
    working_days_count: number | string;
  }): { grantId: string; workingDays: number }[] | undefined {
    if (request.type !== 'annual' || !canEditRequestFunds || decisionAction !== 'approve') {
      return undefined;
    }

    const workingDays = Number(request.working_days_count);
    if (!Number.isFinite(workingDays) || workingDays <= 0) return undefined;

    if (annualFundGrantId === '__split__') {
      const parts = Object.entries(annualFundSplits)
        .map(([grantId, value]) => ({ grantId, workingDays: Number(value) }))
        .filter((part) => Number.isFinite(part.workingDays) && part.workingDays > 0);
      if (parts.length === 0) return undefined;
      const sum = parts.reduce((total, part) => total + part.workingDays, 0);
      if (Math.abs(sum - workingDays) > 0.02) {
        toast.error(`Fund days must total ${workingDays} (currently ${sum}).`);
        return undefined;
      }
      return parts;
    }

    if (!annualFundGrantId) return undefined;
    return [{ grantId: annualFundGrantId, workingDays }];
  }

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
    closeDecisionEditor();
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
            const showAnnualFundEditor =
              isRejecting &&
              canEditRequestFunds &&
              request.type === 'annual' &&
              decisionAction === 'approve' &&
              memberGrants.length > 0;
            const showSickFundEditor =
              isRejecting &&
              canEditRequestFunds &&
              request.type === 'sick' &&
              decisionAction === 'approve' &&
              sickPools.length > 0;

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
                        {formatLeaveBalancePoolLine(request.type, request.balance_project)}
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
                        <Button
                          size="sm"
                          onClick={() => {
                            setDecisionAction('approve');
                            setDecisionNote('');
                            openDecisionEditor(request, 'approve');
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDecisionAction('reject');
                            setDecisionNote('');
                            openDecisionEditor(request, 'reject');
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
                        onClick={() => openDecisionEditor(request)}
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

                    {showSickFundEditor ? (
                      <div className="space-y-2 rounded-md border border-dashed border-border bg-background/80 p-3">
                        <p className="text-sm font-medium">Sick leave pool (system admin)</p>
                        <p className="text-xs text-muted-foreground">
                          Choose which project&apos;s sick allowance this request uses.
                        </p>
                        <select
                          required
                          value={sickPoolProjectId}
                          onChange={(e) => setSickPoolProjectId(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="" disabled>
                            Select project pool…
                          </option>
                          {sickPools.map((pool) => (
                            <option key={pool.projectId} value={pool.projectId}>
                              {formatSickLeavePoolLabel(pool)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}

                    {showAnnualFundEditor ? (
                      <div className="space-y-2 rounded-md border border-dashed border-border bg-background/80 p-3">
                        <p className="text-sm font-medium">Annual fund (system admin)</p>
                        <p className="text-xs text-muted-foreground">
                          Choose which entitlement fund this request uses ({request.working_days_count}{' '}
                          working day{Number(request.working_days_count) === 1 ? '' : 's'} total).
                        </p>
                        <select
                          value={annualFundGrantId}
                          onChange={(e) => {
                            const value = e.target.value;
                            setAnnualFundGrantId(value);
                            if (value !== '__split__') setAnnualFundSplits({});
                          }}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="">Select fund…</option>
                          {memberGrants.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.label || 'Fund'}
                              {g.grant_year != null ? ` (${g.grant_year})` : ''} ·{' '}
                              {fundSourceShortLabel(g.source)}
                            </option>
                          ))}
                          {allocationRows(request).length > 1 ? (
                            <option value="__split__">Split across multiple funds…</option>
                          ) : null}
                        </select>

                        {annualFundGrantId === '__split__' ? (
                          <div className="space-y-2">
                            {memberGrants.map((g) => (
                              <div key={g.id} className="flex flex-wrap items-end gap-2">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <label
                                    htmlFor={`decision-fund-${request.id}-${g.id}`}
                                    className="text-xs text-muted-foreground"
                                  >
                                    {g.label || 'Fund'}
                                  </label>
                                  <Input
                                    id={`decision-fund-${request.id}-${g.id}`}
                                    type="number"
                                    step="0.1"
                                    min={0}
                                    value={annualFundSplits[g.id] ?? ''}
                                    onChange={(e) =>
                                      setAnnualFundSplits((prev) => ({
                                        ...prev,
                                        [g.id]: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

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
                        onClick={() => {
                          const payload: Record<string, unknown> = {
                            action: decisionAction,
                            decisionNote: decisionNote.trim() || null,
                          };
                          if (showAnnualFundEditor) {
                            const allocations = buildAnnualAllocationsPayload(request);
                            if (!allocations) return;
                            payload.annualAllocations = allocations;
                          }
                          if (showSickFundEditor) {
                            if (!sickPoolProjectId) {
                              toast.error('Select a sick leave pool.');
                              return;
                            }
                            payload.balanceProjectId = sickPoolProjectId;
                          }
                          void updateRequest(
                            request.id,
                            payload,
                            decisionAction === 'approve' ? 'Request approved' : 'Request rejected'
                          );
                        }}
                      >
                        Save decision
                      </Button>
                      <Button size="sm" variant="ghost" onClick={closeDecisionEditor}>
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
