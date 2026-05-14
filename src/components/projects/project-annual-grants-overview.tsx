'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
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

export function ProjectAnnualGrantsOverview({ projectId }: { projectId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<GrantRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error: qErr } = await supabase
        .from('annual_entitlement_grants')
        .select('id, user_id, grant_year, label, days_allocated, valid_from, valid_to, source, users(name)')
        .eq('project_id', projectId)
        .order('valid_from', { ascending: true })
        .limit(300);

      if (cancelled) return;
      if (qErr) {
        setError(qErr.message);
        setRows([]);
        return;
      }
      const raw = (data || []) as unknown as Array<
        Omit<GrantRow, 'users'> & { users: { name: string | null } | { name: string | null }[] | null }
      >;
      const normalized: GrantRow[] = raw.map((row) => {
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
      setRows(normalized);
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, supabase]);

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

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const visible = rows.filter((r) => {
    const st = grantStatus(r.valid_from, r.valid_to, todayStr);
    return st === 'active' || st === 'upcoming';
  });

  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active or upcoming entitlement rows yet (or none visible under current RLS). After the first
        year reset with grants enabled, rows appear here with validity windows.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Member</th>
            <th className="px-3 py-2 font-medium">Fund</th>
            <th className="px-3 py-2 font-medium">Year</th>
            <th className="px-3 py-2 font-medium">Valid from</th>
            <th className="px-3 py-2 font-medium">Valid to</th>
            <th className="px-3 py-2 font-medium text-right">Allocated</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {visible.map((r) => {
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
                        : 'rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-100'
                    }
                  >
                    {st === 'active' ? 'Active' : 'Upcoming'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
