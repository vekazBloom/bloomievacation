'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LeaveRequestsPanel } from '@/components/leave/leave-requests-panel';
import { MemberFundsPanel, type MemberFundAllocationLine, type MemberFundGrant } from '@/components/projects/member-funds-panel';
import { MemberProfileTabs } from '@/components/projects/member-profile-tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { formatAllocatedDays } from '@/lib/leave/format-allocated-days';
import { getInitials } from '@/lib/utils';
import { projectPath } from '@/lib/projects/paths';

function approvedOnGrant(lines: MemberFundAllocationLine[], grantId: string): number {
  let s = 0;
  for (const line of lines) {
    if (line.grant_id !== grantId || line.status !== 'approved') continue;
    s += Number(line.working_days || 0);
  }
  return s;
}

export function MemberProfileCardWithTabs({
  projectSlug,
  memberName,
  memberEmail,
  avatarUrl,
  roleLabel,
  annualGlobalApproved,
  annualProjectPool,
  sickGlobalApproved,
  sickProjectTotal,
  religiousGlobalApproved,
  religiousProjectTotal,
  sickProjectApproved,
  religiousProjectApproved,
  grants,
  allocationLines,
  requests,
  canReview,
  currentUserId,
}: {
  projectSlug: string;
  memberName: string;
  memberEmail: string;
  avatarUrl: string | null;
  roleLabel: string;
  annualGlobalApproved: number;
  annualProjectPool: number;
  sickGlobalApproved: number;
  sickProjectTotal: number;
  religiousGlobalApproved: number;
  religiousProjectTotal: number;
  sickProjectApproved: number;
  religiousProjectApproved: number;
  grants: MemberFundGrant[];
  allocationLines: MemberFundAllocationLine[];
  requests: any[];
  canReview: boolean;
  currentUserId: string;
}) {
  const [summaryGrantId, setSummaryGrantId] = useState<string | null>(null);

  const selectedGrant = useMemo(
    () => (summaryGrantId ? grants.find((g) => g.id === summaryGrantId) ?? null : null),
    [grants, summaryGrantId]
  );

  const annualDisplay = useMemo(() => {
    if (selectedGrant) {
      const used = approvedOnGrant(allocationLines, selectedGrant.id);
      const total = Number(selectedGrant.days_allocated || 0);
      return { used, total };
    }
    return {
      used: annualGlobalApproved,
      total: annualProjectPool,
    };
  }, [
    allocationLines,
    annualGlobalApproved,
    annualProjectPool,
    selectedGrant,
  ]);

  const sickDisplay = useMemo(() => {
    if (summaryGrantId) {
      return { used: sickProjectApproved, total: sickProjectTotal };
    }
    return { used: sickGlobalApproved, total: sickProjectTotal };
  }, [sickGlobalApproved, sickProjectApproved, sickProjectTotal, summaryGrantId]);

  const religiousDisplay = useMemo(() => {
    if (summaryGrantId) {
      return { used: religiousProjectApproved, total: religiousProjectTotal };
    }
    return { used: religiousGlobalApproved, total: religiousProjectTotal };
  }, [religiousGlobalApproved, religiousProjectApproved, religiousProjectTotal, summaryGrantId]);

  const footnote = summaryGrantId
    ? selectedGrant
      ? `Annual shows approved days taken from “${selectedGrant.label}” vs that fund’s pool. Sick and religious show approved days in this project vs this team’s allowance.`
      : ''
    : '"Used" sums approved days from every project you belong to; the allowance shown is this team’s allocation.';

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar className="h-16 w-16">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={memberName} /> : null}
            <AvatarFallback>{getInitials(memberName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono uppercase">
                {roleLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{memberEmail}</p>

            {grants.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="balance-scope" className="text-xs text-muted-foreground">
                  Balance scope
                </Label>
                <select
                  id="balance-scope"
                  value={summaryGrantId ?? ''}
                  onChange={(e) => setSummaryGrantId(e.target.value === '' ? null : e.target.value)}
                  className="flex h-9 max-w-md rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">Default — annual “used” across all projects</option>
                  {grants.map((g) => (
                    <option key={g.id} value={g.id}>
                      This fund — {g.label}
                      {g.grant_year != null ? ` (${g.grant_year})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Pick a fund to drive the three numbers below from that fund (annual) and this project (sick /
                  religious). Click a fund card on the Annual funds tab for the same effect.
                </p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Annual</p>
                {selectedGrant ? (
                  <p className="mt-0.5 text-xs font-normal normal-case text-muted-foreground line-clamp-2">
                    {selectedGrant.label}
                  </p>
                ) : null}
                <p className="mt-1 font-mono text-lg tabular-nums">
                  {formatAllocatedDays(annualDisplay.used)} / {formatAllocatedDays(annualDisplay.total)}
                </p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sick</p>
                <p className="mt-1 font-mono text-lg tabular-nums">
                  {formatAllocatedDays(sickDisplay.used)} / {formatAllocatedDays(sickDisplay.total)}
                </p>
              </div>
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Religious</p>
                <p className="mt-1 font-mono text-lg tabular-nums">
                  {formatAllocatedDays(religiousDisplay.used)} / {formatAllocatedDays(religiousDisplay.total)}
                </p>
              </div>
            </div>
            {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
          </div>
        </div>

        <MemberProfileTabs
          leaveLabel="Leave history"
          fundsLabel="Annual funds"
          leaveContent={
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl">Leave history</h2>
                <Button asChild variant="outline" size="sm">
                  <Link href={projectPath(projectSlug, 'calendar')}>Open team calendar</Link>
                </Button>
              </div>
              <LeaveRequestsPanel
                requests={requests}
                canReview={canReview}
                projectSlug={projectSlug}
                currentUserId={currentUserId}
              />
            </div>
          }
          fundsContent={
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl">Annual funds</h2>
                <Button asChild variant="outline" size="sm">
                  <Link href={projectPath(projectSlug, 'requests', 'new')}>New leave request</Link>
                </Button>
              </div>
              <MemberFundsPanel
                projectSlug={projectSlug}
                grants={grants}
                allocationLines={allocationLines}
                selectedSummaryGrantId={summaryGrantId}
                onSelectSummaryGrant={setSummaryGrantId}
              />
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
