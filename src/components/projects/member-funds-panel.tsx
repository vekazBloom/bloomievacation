'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dateInGrantWindow } from '@/lib/leave/entitlement-grants';
import { formatAllocatedDays } from '@/lib/leave/format-allocated-days';
import { formatPolicyDate } from '@/lib/leave/annual-policy-dates';
import { projectPath } from '@/lib/projects/paths';
import { cn } from '@/lib/utils';

export type MemberFundGrant = {
  id: string;
  label: string;
  grant_year: number | null;
  valid_from: string;
  valid_to: string | null;
  source: string;
  days_allocated: number;
  definition_id: string | null;
  definition_label: string | null;
};

export type MemberFundAllocationLine = {
  grant_id: string;
  working_days: number;
  request_id: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
};

function parseLocalDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function grantStatus(
  validFrom: string,
  validTo: string | null,
  todayStr: string
): 'upcoming' | 'active' | 'ended' {
  if (todayStr < validFrom) return 'upcoming';
  if (!validTo || todayStr <= validTo) return 'active';
  return 'ended';
}

function statusBadgeClass(st: 'upcoming' | 'active' | 'ended') {
  if (st === 'active') {
    return 'rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-200';
  }
  if (st === 'upcoming') {
    return 'rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-100';
  }
  return 'rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground';
}

export function MemberFundsPanel({
  projectSlug,
  grants,
  allocationLines,
  selectedSummaryGrantId = null,
  onSelectSummaryGrant,
}: {
  projectSlug: string;
  grants: MemberFundGrant[];
  allocationLines: MemberFundAllocationLine[];
  selectedSummaryGrantId?: string | null;
  onSelectSummaryGrant?: (id: string | null) => void;
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'ended'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'legacy_migration' | 'grant' | 'carryover'>('all');
  const [search, setSearch] = useState('');

  const grantById = useMemo(() => new Map(grants.map((g) => [g.id, g])), [grants]);

  const linesByGrant = useMemo(() => {
    const m = new Map<string, MemberFundAllocationLine[]>();
    for (const line of allocationLines) {
      const grant = grantById.get(line.grant_id);
      if (!grant || !dateInGrantWindow(grant, line.start_date)) continue;
      const arr = m.get(line.grant_id) || [];
      arr.push(line);
      m.set(line.grant_id, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }
    return m;
  }, [allocationLines, grantById]);

  const reservedByGrant = useMemo(() => {
    const m = new Map<string, number>();
    for (const line of allocationLines) {
      if (line.status !== 'pending' && line.status !== 'approved') continue;
      const grant = grantById.get(line.grant_id);
      if (!grant || !dateInGrantWindow(grant, line.start_date)) continue;
      m.set(line.grant_id, (m.get(line.grant_id) || 0) + Number(line.working_days || 0));
    }
    return m;
  }, [allocationLines, grantById]);

  const filteredGrants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grants.filter((g) => {
      const st = grantStatus(g.valid_from, g.valid_to, todayStr);
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (sourceFilter !== 'all' && g.source !== sourceFilter) return false;
      if (q) {
        const blob = `${g.label} ${g.source} ${g.grant_year ?? ''} ${g.definition_label ?? ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [grants, search, sourceFilter, statusFilter, todayStr]);

  if (grants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No annual entitlement funds are set up for this member in this project yet. Admins configure funds in
        project settings; requests will attach here once funds exist.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="fund-filter-status" className="text-xs text-muted-foreground">
            Fund period
          </Label>
          <select
            id="fund-filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="flex h-9 min-w-[140px] rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="upcoming">Upcoming</option>
            <option value="ended">Ended</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="fund-filter-source" className="text-xs text-muted-foreground">
            Source
          </Label>
          <select
            id="fund-filter-source"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
            className="flex h-9 min-w-[140px] rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All</option>
            <option value="legacy_migration">Legacy</option>
            <option value="grant">Year grant</option>
            <option value="carryover">Carryover</option>
          </select>
        </div>
        <div className="min-w-[200px] flex-1 space-y-1">
          <Label htmlFor="fund-search" className="text-xs text-muted-foreground">
            Search
          </Label>
          <Input
            id="fund-search"
            placeholder="Filter by fund name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Reserved</strong> counts pending and approved annual requests. Other statuses still appear under
        each fund so you can see which request targeted which pool.
      </p>

      <div className="space-y-4">
        {filteredGrants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No funds match these filters.</p>
        ) : (
          filteredGrants.map((g) => {
            const st = grantStatus(g.valid_from, g.valid_to, todayStr);
            const allocated = Number(g.days_allocated || 0);
            const reserved = reservedByGrant.get(g.id) || 0;
            const remaining = allocated - reserved;
            const lines = linesByGrant.get(g.id) || [];
            return (
              <div
                key={g.id}
                className={cn(
                  'rounded-lg border border-border bg-card/60 p-4 shadow-sm transition-shadow',
                  onSelectSummaryGrant && 'cursor-pointer hover:bg-card',
                  selectedSummaryGrantId === g.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                )}
                onClick={
                  onSelectSummaryGrant
                    ? (e) => {
                        if ((e.target as HTMLElement).closest('a')) return;
                        onSelectSummaryGrant(selectedSummaryGrantId === g.id ? null : g.id);
                      }
                    : undefined
                }
                onKeyDown={
                  onSelectSummaryGrant
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectSummaryGrant(selectedSummaryGrantId === g.id ? null : g.id);
                        }
                      }
                    : undefined
                }
                role={onSelectSummaryGrant ? 'button' : undefined}
                tabIndex={onSelectSummaryGrant ? 0 : undefined}
                aria-pressed={onSelectSummaryGrant ? selectedSummaryGrantId === g.id : undefined}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium text-foreground">{g.label}</h3>
                      <span className={statusBadgeClass(st)}>
                        {st === 'active' ? 'Active' : st === 'upcoming' ? 'Upcoming' : 'Ended'}
                      </span>
                      <Badge variant="outline" className="text-xs font-normal">
                        {g.source}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatPolicyDate(parseLocalDay(g.valid_from))}
                      {' — '}
                      {g.valid_to ? formatPolicyDate(parseLocalDay(g.valid_to)) : 'no end'}
                      {g.grant_year != null ? ` · year ${g.grant_year}` : null}
                      {g.definition_label ? ` · template: ${g.definition_label}` : null}
                    </p>
                  </div>
                  <div className="text-right text-sm tabular-nums">
                    <p>
                      <span className="text-muted-foreground">Allocated </span>
                      <span className="font-medium">{formatAllocatedDays(allocated)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Reserved </span>
                      <span className="font-medium">{formatAllocatedDays(reserved)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Remaining </span>
                      <span className="font-medium">{formatAllocatedDays(remaining)}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Annual requests using this fund
                  </p>
                  {lines.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No requests allocated to this fund yet.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                      {lines.map((line) => (
                        <li key={`${line.request_id}-${line.grant_id}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                          <Link
                            href={projectPath(projectSlug, 'requests', line.request_id)}
                            className="font-medium text-primary hover:underline"
                          >
                            {line.start_date} → {line.end_date}
                          </Link>
                          <span className="text-muted-foreground">
                            {formatAllocatedDays(line.working_days)} d from this fund
                          </span>
                          <Badge
                            variant={
                              line.status === 'approved'
                                ? 'success'
                                : line.status === 'pending'
                                  ? 'pending'
                                  : 'secondary'
                            }
                            className="text-xs"
                          >
                            {line.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
