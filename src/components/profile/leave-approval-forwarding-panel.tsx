'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { formatDateRange } from '@/lib/utils';

type PendingRow = {
  id: string;
  startDate: string;
  endDate: string;
  typeLabel: string;
  workingDays: number;
  decidedAt: string | null;
  employeeName: string;
  projectName: string;
};

export function LeaveApprovalForwardingPanel() {
  const [emailsText, setEmailsText] = useState('');
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/leave-approval-forwarding', { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Failed to load');
        return;
      }
      setEmailsText((body.emails as string[]).join('\n'));
      setPending(body.pending as PendingRow[]);
      setSelected({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingIds = useMemo(() => pending.map((p) => p.id), [pending]);
  const allSelected =
    pendingIds.length > 0 && pendingIds.every((id) => selected[id]);
  const selectedIds = useMemo(
    () => pendingIds.filter((id) => selected[id]),
    [pendingIds, selected]
  );

  async function saveEmails() {
    setSaving(true);
    setMessage(null);
    setError(null);
    const raw = emailsText
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const unique = [...new Set(raw.map((e) => e.toLowerCase()))];
    try {
      const res = await fetch('/api/profile/leave-approval-forwarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: unique }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Save failed');
        return;
      }
      setEmailsText((body.emails as string[]).join('\n'));
      setMessage('Forwarding addresses saved.');
    } finally {
      setSaving(false);
    }
  }

  async function sendSelected() {
    if (selectedIds.length === 0) return;
    setSending(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/profile/leave-approval-forwarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestIds: selectedIds }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Send failed');
        return;
      }
      const failed = (body.failedCount as number) ?? 0;
      if (failed > 0) {
        setError(`${failed} request(s) could not be sent (check Resend / logs).`);
      } else {
        setMessage(`Sent ${selectedIds.length} summary email(s).`);
      }
      await load();
    } finally {
      setSending(false);
    }
  }

  function toggleAll(checked: boolean) {
    const next: Record<string, boolean> = {};
    for (const id of pendingIds) next[id] = checked;
    setSelected(next);
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
            When you approve annual or sick leave, we email a short summary to each address below (employee,
            projects, days, type, who approved, and their global balance snapshot).
          </p>
        </div>
        <CardContent className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="forward-emails-area">Email addresses (one per line)</Label>
            <textarea
              id="forward-emails-area"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder={'finance@company.com\nhr@company.com'}
              aria-label="Forwarding email addresses"
            />
          </div>
          <Button type="button" onClick={() => void saveEmails()} disabled={saving}>
            {saving ? 'Saving…' : 'Save addresses'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg">Approved leave — not yet forwarded</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These are past approvals you made (annual or sick) before forwarding was enabled. Select rows and
            send the same summary email now.
          </p>
        </div>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">Nothing pending.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3">
                <div className="flex items-center gap-2">
                  <input
                    id="select-all-forward"
                    type="checkbox"
                    className="h-4 w-4 rounded border border-input"
                    checked={allSelected}
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  <Label htmlFor="select-all-forward" className="text-sm font-normal cursor-pointer">
                    Select all
                  </Label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={sending || selectedIds.length === 0}
                  onClick={() => void sendSelected()}
                >
                  {sending ? 'Sending…' : `Send selected (${selectedIds.length})`}
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="w-10 px-4 py-2" />
                      <th className="px-4 py-2 font-medium">Employee</th>
                      <th className="px-4 py-2 font-medium">Project</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Days</th>
                      <th className="px-4 py-2 font-medium">Dates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((row) => (
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
                        <td className="px-4 py-2 font-medium">{row.employeeName}</td>
                        <td className="px-4 py-2">{row.projectName}</td>
                        <td className="px-4 py-2">{row.typeLabel}</td>
                        <td className="px-4 py-2">{row.workingDays}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatDateRange(row.startDate, row.endDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
