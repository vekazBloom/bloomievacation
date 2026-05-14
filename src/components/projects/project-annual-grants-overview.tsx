'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Pencil, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { formatAllocatedDays } from '@/lib/leave/format-allocated-days';
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
  definition_id: string | null;
  users: { name: string | null } | null;
};

type FundDefinition = { id: string; label: string };

function parseLocalDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function grantStatus(validFrom: string, validTo: string | null, todayStr: string): 'upcoming' | 'active' | 'ended' {
  if (todayStr < validFrom) return 'upcoming';
  if (!validTo || todayStr <= validTo) return 'active';
  return 'ended';
}

function normalizeRows(data: unknown): GrantRow[] {
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
  const [definitions, setDefinitions] = useState<FundDefinition[]>([]);
  const [editRow, setEditRow] = useState<GrantRow | null>(null);
  const [formDefId, setFormDefId] = useState('');
  const [formDays, setFormDays] = useState('');
  const [saving, setSaving] = useState(false);

  const defLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of definitions) m.set(d.id, d.label);
    return m;
  }, [definitions]);

  const loadRows = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from('annual_entitlement_grants')
      .select(
        'id, user_id, grant_year, label, days_allocated, valid_from, valid_to, source, definition_id, users(name)'
      )
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

  const loadDefinitions = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectSlug)}/annual-fund-definitions`
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return;
    const list = (payload.definitions || []) as FundDefinition[];
    setDefinitions(list.map((d) => ({ id: d.id, label: d.label })));
  }, [projectSlug]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  useEffect(() => {
    void loadDefinitions();
  }, [loadDefinitions]);

  useEffect(() => {
    if (!editRow) return;
    setFormDefId(editRow.definition_id ?? '');
    setFormDays(String(Math.round(Number(editRow.days_allocated))));
  }, [editRow]);

  async function saveGrant() {
    if (!editRow) return;
    const days = Number(formDays);
    if (!Number.isFinite(days) || days < 0) {
      toast.error('Enter a valid number of days');
      return;
    }
    setSaving(true);
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectSlug)}/annual-grants/${encodeURIComponent(editRow.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          definition_id: formDefId === '' ? null : formDefId,
          days_allocated: days,
        }),
      }
    );
    const payload = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(payload.error || 'Failed to save');
      return;
    }
    toast.success('Fund updated');
    setEditRow(null);
    await loadRows();
    void loadDefinitions();
    router.refresh();
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">
        Could not load team funds{error ? `: ${error}` : ''}. If migrations 012–013 are not applied yet, this
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
        No entitlement rows yet. After migration 012 and member sync, legacy rows appear here.
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

  const memberName = editRow?.users?.name || editRow?.user_id.slice(0, 8) || '';

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
              <th className="px-3 py-2 font-medium">Definition</th>
              <th className="px-3 py-2 w-20 font-medium"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((r) => {
              const st = grantStatus(r.valid_from, r.valid_to, todayStr);
              const defLabel = r.definition_id ? defLabelById.get(r.definition_id) : undefined;
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
                  <td className="px-3 py-2 text-right tabular-nums">{formatAllocatedDays(r.days_allocated)}</td>
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
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.definition_id ? defLabel ?? 'Linked' : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => setEditRow(r)}
                      aria-label={`Edit fund for ${r.users?.name || r.user_id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog.Root open={editRow !== null} onOpenChange={(o) => !o && setEditRow(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(100%-2rem,26rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="font-display text-xl">Edit team fund</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {memberName} · {editRow?.source}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button type="button" size="icon" variant="ghost" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>

            <div className="mt-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="grant-def">Fund definition</Label>
                <select
                  id="grant-def"
                  value={formDefId}
                  onChange={(e) => setFormDefId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Not linked</option>
                  {definitions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Choosing a definition copies its name and validity window onto this row.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grant-days">Allocated working days</Label>
                <Input
                  id="grant-days"
                  type="number"
                  min={0}
                  step={1}
                  value={formDays}
                  onChange={(e) => setFormDays(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Cannot be less than approved and pending leave already booked on this fund. For{' '}
                  <strong>legacy</strong> rows, this updates the member&apos;s annual total (together with carried
                  over) so it stays in sync with Manage members.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Button type="button" onClick={() => void saveGrant()} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
