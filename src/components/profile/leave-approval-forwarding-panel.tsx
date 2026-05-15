'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDate, formatDateRange } from '@/lib/utils';

type ForwardAddress = {
  id?: string;
  email: string;
  sendEnabled: boolean;
};

type ApprovalRow = {
  id: string;
  startDate: string;
  endDate: string;
  typeLabel: string;
  workingDays: number;
  decidedAt: string | null;
  forwardSentAt: string | null;
  forwardSent: boolean;
  employeeName: string;
  projectName: string;
};

type SendFilter = 'not_sent' | 'sent' | 'all';

function parseNewEmails(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\n,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
}

function selectionForRows(rows: ApprovalRow[]): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const row of rows) next[row.id] = true;
  return next;
}

export function LeaveApprovalForwardingPanel() {
  const [addresses, setAddresses] = useState<ForwardAddress[]>([]);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [requests, setRequests] = useState<ApprovalRow[]>([]);
  const [sendFilter, setSendFilter] = useState<SendFilter>('not_sent');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const applyPayload = useCallback((body: Record<string, unknown>, options?: { resetListUi?: boolean }) => {
    setAddresses(
      (body.addresses as { id: string; email: string; sendEnabled: boolean }[]).map((a) => ({
        id: a.id,
        email: a.email,
        sendEnabled: a.sendEnabled,
      }))
    );
    const loaded = (body.requests ?? body.pending) as ApprovalRow[];
    setRequests(loaded);
    if (options?.resetListUi) {
      const notSent = loaded.filter((r) => !r.forwardSent);
      setSelected(selectionForRows(notSent));
      setSendFilter('not_sent');
    }
  }, []);

  const load = useCallback(
    async (options?: { preserveUi?: boolean }) => {
      if (!options?.preserveUi) {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await fetch('/api/profile/leave-approval-forwarding', { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error || 'Failed to load');
          return;
        }
        applyPayload(body, { resetListUi: !options?.preserveUi });
      } finally {
        if (!options?.preserveUi) {
          setLoading(false);
        }
      }
    },
    [applyPayload]
  );

  function markRequestsSent(ids: string[]) {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    const idSet = new Set(ids);
    setRequests((prev) =>
      prev.map((r) =>
        idSet.has(r.id) ? { ...r, forwardSent: true, forwardSentAt: now } : r
      )
    );
  }

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRequests = useMemo(() => {
    if (sendFilter === 'sent') return requests.filter((r) => r.forwardSent);
    if (sendFilter === 'not_sent') return requests.filter((r) => !r.forwardSent);
    return requests;
  }, [requests, sendFilter]);

  const filteredIds = useMemo(() => filteredRequests.map((r) => r.id), [filteredRequests]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected[id]);
  const selectedIds = useMemo(
    () => filteredIds.filter((id) => selected[id]),
    [filteredIds, selected]
  );
  const selectedHasNotSent = useMemo(
    () => selectedIds.some((id) => !requests.find((r) => r.id === id)?.forwardSent),
    [selectedIds, requests]
  );
  const selectedHasSent = useMemo(
    () => selectedIds.some((id) => requests.find((r) => r.id === id)?.forwardSent),
    [selectedIds, requests]
  );
  const enabledCount = useMemo(
    () => addresses.filter((a) => a.sendEnabled).length,
    [addresses]
  );
  const notSentCount = useMemo(() => requests.filter((r) => !r.forwardSent).length, [requests]);
  const sentCount = useMemo(() => requests.filter((r) => r.forwardSent).length, [requests]);

  function addEmailsFromInput() {
    const incoming = parseNewEmails(newEmailInput);
    if (incoming.length === 0) return;

    const existing = new Set(addresses.map((a) => a.email.toLowerCase()));
    const toAdd = incoming.filter((e) => !existing.has(e));
    if (toAdd.length === 0) {
      setNewEmailInput('');
      return;
    }

    setAddresses((prev) => [
      ...prev,
      ...toAdd.map((email) => ({ email, sendEnabled: true })),
    ]);
    setNewEmailInput('');
  }

  function removeAddress(email: string) {
    setAddresses((prev) => prev.filter((a) => a.email !== email));
  }

  function toggleSendEnabled(email: string, sendEnabled: boolean) {
    setAddresses((prev) =>
      prev.map((a) => (a.email === email ? { ...a, sendEnabled } : a))
    );
  }

  async function saveAddresses() {
    setSaving(true);
    setMessage(null);
    setError(null);

    const draft = parseNewEmails(newEmailInput);
    const merged = [...addresses];
    const existing = new Set(merged.map((a) => a.email.toLowerCase()));
    for (const email of draft) {
      if (!existing.has(email)) {
        merged.push({ email, sendEnabled: true });
        existing.add(email);
      }
    }

    try {
      const res = await fetch('/api/profile/leave-approval-forwarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses: merged.map((a) => ({
            email: a.email,
            sendEnabled: a.sendEnabled,
          })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Save failed');
        return;
      }
      setAddresses(
        (body.addresses as { id: string; email: string; sendEnabled: boolean }[]).map((a) => ({
          id: a.id,
          email: a.email,
          sendEnabled: a.sendEnabled,
        }))
      );
      setNewEmailInput('');
      setMessage('Forwarding addresses saved.');
    } finally {
      setSaving(false);
    }
  }

  async function sendRequestIds(requestIds: string[], successMessage: string) {
    if (requestIds.length === 0) return;
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/profile/leave-approval-forwarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Send failed');
        return;
      }
      const results = (body.results as { id: string; ok: boolean }[] | undefined) ?? [];
      const okIds = results.filter((r) => r.ok).map((r) => r.id);
      const failed = (body.failedCount as number) ?? results.filter((r) => !r.ok).length;

      if (okIds.length > 0) {
        markRequestsSent(okIds);
      }

      if (failed > 0) {
        setError(`${failed} request(s) could not be sent (check Resend / logs).`);
        if (okIds.length > 0) {
          setMessage(
            `${okIds.length} sent. ${failed} failed — scroll position and filter unchanged.`
          );
        }
      } else {
        setMessage(successMessage);
      }
    } catch {
      setError('Send failed');
    }
  }

  async function sendSelected() {
    if (selectedIds.length === 0) return;
    setSending(true);
    try {
      const label =
        selectedHasSent && !selectedHasNotSent
          ? `Resent ${selectedIds.length} summary email(s).`
          : `Sent ${selectedIds.length} summary email(s).`;
      await sendRequestIds(selectedIds, label);
    } finally {
      setSending(false);
    }
  }

  async function resendOne(id: string) {
    setResendingId(id);
    try {
      await sendRequestIds([id], 'Summary email resent.');
    } finally {
      setResendingId(null);
    }
  }

  function toggleAllFiltered(checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const id of filteredIds) next[id] = checked;
      return next;
    });
  }

  function applyFilter(next: SendFilter) {
    setSendFilter(next);
    const rows =
      next === 'sent'
        ? requests.filter((r) => r.forwardSent)
        : next === 'not_sent'
          ? requests.filter((r) => !r.forwardSent)
          : requests;
    setSelected(selectionForRows(rows));
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg">Forwarding addresses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved addresses stay on this page. Check which ones should receive a copy when you approve annual
            or sick leave.
          </p>
        </div>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="new-forward-email">Add email</Label>
              <Input
                id="new-forward-email"
                type="email"
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addEmailsFromInput();
                  }
                }}
                placeholder="finance@company.com"
              />
            </div>
            <Button type="button" variant="outline" onClick={addEmailsFromInput}>
              Add
            </Button>
          </div>

          {addresses.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {addresses.map((row) => (
                <li
                  key={row.id ?? row.email}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <input
                    type="checkbox"
                    id={`send-${row.email}`}
                    className="h-4 w-4 shrink-0 rounded border border-input"
                    checked={row.sendEnabled}
                    onChange={(e) => toggleSendEnabled(row.email, e.target.checked)}
                    aria-label={`Send copies to ${row.email}`}
                  />
                  <Label
                    htmlFor={`send-${row.email}`}
                    className="min-w-0 flex-1 cursor-pointer text-sm font-normal"
                  >
                    <span className="font-medium text-foreground">{row.email}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {row.sendEnabled ? 'Will receive approval copies' : 'Saved, not receiving copies'}
                    </span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAddress(row.email)}
                    aria-label={`Remove ${row.email}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No saved addresses yet.</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void saveAddresses()} disabled={saving}>
              {saving ? 'Saving…' : 'Save addresses'}
            </Button>
            {addresses.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {enabledCount} of {addresses.length} address{addresses.length === 1 ? '' : 'es'} enabled for
                sending
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg">Your approved leave</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            All annual and sick requests you approved. Filter by whether the summary email was sent, then send
            or resend.
          </p>
        </div>
        <CardContent className="p-0">
          {requests.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No approved annual or sick leave yet.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-3 border-b border-border px-6 py-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="flex flex-wrap gap-2" role="group" aria-label="Email send status filter">
                  <Button
                    type="button"
                    size="sm"
                    variant={sendFilter === 'not_sent' ? 'default' : 'outline'}
                    onClick={() => applyFilter('not_sent')}
                  >
                    Not sent ({notSentCount})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sendFilter === 'sent' ? 'default' : 'outline'}
                    onClick={() => applyFilter('sent')}
                  >
                    Sent ({sentCount})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={sendFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => applyFilter('all')}
                  >
                    All ({requests.length})
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
                  <div className="flex items-center gap-2">
                    <input
                      id="select-all-forward"
                      type="checkbox"
                      className="h-4 w-4 rounded border border-input"
                      checked={allFilteredSelected}
                      onChange={(e) => toggleAllFiltered(e.target.checked)}
                    />
                    <Label htmlFor="select-all-forward" className="text-sm font-normal cursor-pointer">
                      Select all in view
                    </Label>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={sending || selectedIds.length === 0 || enabledCount === 0}
                    onClick={() => void sendSelected()}
                  >
                    {sending
                      ? 'Sending…'
                      : selectedHasSent && !selectedHasNotSent
                        ? `Resend selected (${selectedIds.length})`
                        : `Send selected (${selectedIds.length})`}
                  </Button>
                </div>
              </div>

              {enabledCount === 0 ? (
                <p className="border-b border-border px-6 py-2 text-xs text-muted-foreground">
                  Enable at least one address above to send.
                </p>
              ) : null}

              {filteredRequests.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  No requests in this filter.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="w-10 px-4 py-2" />
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Employee</th>
                        <th className="px-4 py-2 font-medium">Project</th>
                        <th className="px-4 py-2 font-medium">Type</th>
                        <th className="px-4 py-2 font-medium">Days</th>
                        <th className="px-4 py-2 font-medium">Dates</th>
                        <th className="px-4 py-2 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRequests.map((row) => (
                        <tr key={row.id} className="border-b border-border/60">
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border border-input"
                              checked={Boolean(selected[row.id])}
                              onChange={(e) =>
                                setSelected((prev) => ({ ...prev, [row.id]: e.target.checked }))
                              }
                              aria-label={`Select ${row.employeeName}`}
                            />
                          </td>
                          <td className="px-4 py-2">
                            {row.forwardSent ? (
                              <Badge variant="success" title={row.forwardSentAt || undefined}>
                                Sent
                              </Badge>
                            ) : (
                              <Badge variant="warning">Not sent</Badge>
                            )}
                            {row.forwardSentAt ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDate(row.forwardSentAt, 'short')}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-2 font-medium">{row.employeeName}</td>
                          <td className="px-4 py-2">{row.projectName}</td>
                          <td className="px-4 py-2">{row.typeLabel}</td>
                          <td className="px-4 py-2">{row.workingDays}</td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {formatDateRange(row.startDate, row.endDate)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {row.forwardSent ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={resendingId === row.id || enabledCount === 0}
                                onClick={() => void resendOne(row.id)}
                              >
                                {resendingId === row.id ? 'Sending…' : 'Resend'}
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={sending || enabledCount === 0}
                                onClick={() => void sendRequestIds([row.id], 'Summary email sent.')}
                              >
                                Send
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
