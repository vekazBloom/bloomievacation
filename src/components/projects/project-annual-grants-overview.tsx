'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatPolicyDate } from '@/lib/leave/annual-policy-dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type GrantRow = {
  id: string;
  user_id: string;
  grant_year: number | null;
  label: string;
  days_allocated: number;
  valid_from: string;
  valid_to: string | null;
  source: string;
  users: { name: string | null } | null;
};

function parseLocalDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Aligns with `dateInGrantWindow`: valid_to is inclusive when present. */
function grantStatus(validFrom: string, validTo: string | null, todayStr: string): 'upcoming' | 'active' | 'ended' {
  if (todayStr < validFrom) return 'upcoming';
  if (!validTo || todayStr <= validTo) return 'active';
  return 'ended';
}

function normalizeRows(
  data: unknown
): GrantRow[] {
  const raw = (data || []) as unknown as Array<
    Omit<GrantRow, 'users'> & { users: { name: string | null } | { name: string | null }[] | null }
  >;
  return raw.map((row) => {
    const u = row.users;
    const users =
      u == null
        ? null
        : Array.isArray(u)
          ? u[0]
            ? { name: u[0].name }
            : null
          : { name: u.name };
    return { ...row, users };
  });
}

type EditState = {
  row: GrantRow;
  label: string;
  valid_from: string;
  valid_to: string;
  grant_year: string;
  days_allocated: string;
};

export function ProjectAnnualGrantsOverview({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<GrantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadRows = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from('annual_entitlement_grants')
      .select('id, user_id, grant_year, label, days_allocated, valid_from, valid_to, source, users(name)')
      .eq('project_id', projectId)
      .order('valid_from', { ascending: true })
      .limit(300);

    if (qErr) {
      setError(qErr.message);
      setRows([]);
      return;
    }
    setRows(normalizeRows(data));
    setError(null);
  }, [projectId, supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadRows();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [loadRows]);

  function openEdit(row: GrantRow) {
    setEdit({
      row,
      label: row.label,
      valid_from: row.valid_from,
      valid_to: row.valid_to ?? '',
      grant_year: row.grant_year != null ? String(row.grant_year) : '',
      days_allocated: String(row.days_allocated),
    });
  }

  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    const isLegacy = edit.row.source === 'legacy_migration';
    const body: Record<string, unknown> = {
      label: edit.label.trim(),
      valid_from: edit.valid_from,
      valid_to: edit.valid_to.trim() === '' ? null : edit.valid_to.trim(),
      grant_year: edit.grant_year.trim() === '' ? null : Number(edit.grant_year),
    };
    if (!isLegacy) {
      body.days_allocated = Number(edit.days_allocated);
      if (!Number.isFinite(body.days_allocated as number) || (body.days_allocated as number) < 0) {
        toast.error('Allocated days must be a valid non-negative number');
        setSaving(false);
        return;
      }
    }

    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectSlug)}/annual-grants/${encodeURIComponent(edit.row.id)}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      toast.error(payload.error || 'Failed to save fund');
      return;
    }
    toast.success('Fund updated');
    setEdit(null);
    await loadRows();
    router.refresh();
  }

  async function deleteFund() {
    if (!edit) return;
    if (edit.row.source === 'legacy_migration') return;
    const ok = window.confirm('Delete this fund? Only allowed when no leave allocations reference it.');
    if (!ok) return;
    setDeleting(true);
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectSlug)}/annual-grants/${encodeURIComponent(edit.row.id)}`,
      { method: 'DELETE' }
    );
    const payload = await response.json().catch(() => ({}));
    setDeleting(false);
    if (!response.ok) {
      toast.error(payload.error || 'Failed to delete fund');
      return;
    }
    toast.success('Fund deleted');
    setEdit(null);
    await loadRows();
    router.refresh();
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load team funds{error ? `: ${error}` : ''}. If migration 012 is not applied yet, this
        query will fail.
      </p>
    );
  }

  if (rows === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading team annual funds…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No entitlement rows yet. After migration 012 and member sync, legacy rows appear here; yearly
        grants appear after the year-reset job runs.
      </p>
    );
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const sorted = [...rows].sort((a, b) => {
    const nameA = a.users?.name || a.user_id;
    const nameB = b.users?.name || b.user_id;
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return a.valid_from.localeCompare(b.valid_from);
  });

  const isLegacy = edit?.row.source === 'legacy_migration';

  return (
    <>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Member</th>
              <th className="px-3 py-2 font-medium">Fund</th>
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Valid from</th>
              <th className="px-3 py-2 font-medium">Valid to</th>
              <th className="px-3 py-2 font-medium text-right">Allocated</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((r) => {
              const st = grantStatus(r.valid_from, r.valid_to, todayStr);
              return (
                <tr key={r.id} className="bg-card/80">
                  <td className="px-3 py-2">{r.users?.name || r.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">
                    {r.label}
                    <span className="ml-1 text-xs text-muted-foreground">({r.source})</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.grant_year ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatPolicyDate(parseLocalDay(r.valid_from))}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.valid_to ? formatPolicyDate(parseLocalDay(r.valid_to)) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(r.days_allocated).toFixed(1)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        st === 'active'
                          ? 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200'
                          : st === 'upcoming'
                            ? 'rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-100'
                            : 'rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground'
                      }
                    >
                      {st === 'active' ? 'Active' : st === 'upcoming' ? 'Upcoming' : 'Ended'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={() => openEdit(r)}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {edit ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onClick={() => !saving && !deleting && setEdit(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fund-edit-title"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="fund-edit-title" className="font-display text-lg font-medium">
              Edit annual fund
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Member: {edit.row.users?.name || edit.row.user_id} · {edit.row.source}
            </p>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fund-label">Fund name (label)</Label>
                <Input
                  id="fund-label"
                  value={edit.label}
                  onChange={(e) => setEdit((s) => (s ? { ...s, label: e.target.value } : s))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fund-from">Valid from</Label>
                  <Input
                    id="fund-from"
                    type="date"
                    value={edit.valid_from}
                    onChange={(e) => setEdit((s) => (s ? { ...s, valid_from: e.target.value } : s))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fund-to">Valid to (empty = no end)</Label>
                  <Input
                    id="fund-to"
                    type="date"
                    value={edit.valid_to}
                    onChange={(e) => setEdit((s) => (s ? { ...s, valid_to: e.target.value } : s))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-year">Grant year (optional)</Label>
                <Input
                  id="fund-year"
                  type="number"
                  min={1900}
                  max={2100}
                  placeholder="e.g. 2026"
                  value={edit.grant_year}
                  onChange={(e) => setEdit((s) => (s ? { ...s, grant_year: e.target.value } : s))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fund-days">Allocated working days</Label>
                {isLegacy ? (
                  <>
                    <Input
                      id="fund-days"
                      readOnly
                      className="bg-muted"
                      value={edit.days_allocated}
                      aria-readonly
                    />
                    <p className="text-xs text-muted-foreground">
                      Legacy pool size is synced from the member&apos;s annual totals on the Members page
                      (total + carried over). You can still rename the fund and adjust validity dates here.
                    </p>
                  </>
                ) : (
                  <Input
                    id="fund-days"
                    type="number"
                    step="0.1"
                    min={0}
                    value={edit.days_allocated}
                    onChange={(e) => setEdit((s) => (s ? { ...s, days_allocated: e.target.value } : s))}
                  />
                )}
              </div>

              <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium text-foreground">When does the fund stop being usable?</span>{' '}
                  Set <strong>Valid to</strong>. After that date, new requests cannot start drawing from this
                  fund.
                </p>
                <p>
                  <span className="font-medium text-foreground">When are days &quot;used up&quot;?</span>{' '}
                  Through approved and pending leave allocations. You cannot set allocated days below that
                  reserved total.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {!isLegacy ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={saving || deleting}
                    onClick={() => void deleteFund()}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Delete fund
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={saving || deleting} onClick={() => setEdit(null)}>
                  Cancel
                </Button>
                <Button type="button" disabled={saving || deleting} onClick={() => void saveEdit()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
