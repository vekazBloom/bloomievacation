'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatAllocatedDays } from '@/lib/leave/format-allocated-days';
import { formatPolicyDate } from '@/lib/leave/annual-policy-dates';

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

export function ProjectAnnualGrantsOverview({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<GrantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

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

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[680px] text-sm">
        <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Member</th>
            <th className="px-3 py-2 font-medium">Fund</th>
            <th className="px-3 py-2 font-medium">Year</th>
            <th className="px-3 py-2 font-medium">Valid from</th>
            <th className="px-3 py-2 font-medium">Valid to</th>
            <th className="px-3 py-2 font-medium text-right">Allocated</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Template</th>
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
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.definition_id ? 'Yes' : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
