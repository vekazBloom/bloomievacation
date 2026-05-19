'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { LeaveRequestsPanel } from '@/components/leave/leave-requests-panel';
import {
  MemberFundsPanel,
  type MemberFundAllocationLine,
  type MemberFundGrant,
} from '@/components/projects/member-funds-panel';
import { MemberProfileTabs } from '@/components/projects/member-profile-tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

function reservedOnGrant(lines: MemberFundAllocationLine[], grantId: string): number {
  let s = 0;
  for (const line of lines) {
    if (line.grant_id !== grantId) continue;
    if (line.status !== 'pending' && line.status !== 'approved') continue;
    s += Number(line.working_days || 0);
  }
  return s;
}

const selectClassName =
  'flex h-9 max-w-md w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

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
  assignedTemplateIds,
  allocationLines,
  requests,
  canReview,
  canManage,
  fundDefinitions,
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
  assignedTemplateIds: string[];
  allocationLines: MemberFundAllocationLine[];
  requests: any[];
  canReview: boolean;
  canManage: boolean;
  fundDefinitions: Array<{ id: string; label: string }>;
  currentUserId: string;
}) {
  const router = useRouter();

  const scopeGrants = useMemo(
    () => [...grants].sort((a, b) => a.valid_from.localeCompare(b.valid_from)),
    [grants]
  );

  const assignedGrants = useMemo(() => {
    const set = new Set(assignedTemplateIds.filter(Boolean));
    if (set.size === 0) return [];
    return grants.filter((g) => g.definition_id != null && set.has(g.definition_id));
  }, [grants, assignedTemplateIds]);

  const [summaryGrantId, setSummaryGrantId] = useState<string | null>(null);
  const [editDays, setEditDays] = useState('');
  const [editDefinitionId, setEditDefinitionId] = useState('');
  const [isSavingGrant, setIsSavingGrant] = useState(false);

  useEffect(() => {
    if (scopeGrants.length === 0) {
      setSummaryGrantId(null);
      return;
    }
    setSummaryGrantId((prev) => {
      if (prev && scopeGrants.some((g) => g.id === prev)) return prev;
      return assignedGrants[0]?.id ?? scopeGrants[0].id;
    });
  }, [scopeGrants, assignedGrants, assignedTemplateIds.join('|')]);

  const selectedGrant = useMemo(
    () => (summaryGrantId ? grants.find((g) => g.id === summaryGrantId) ?? null : null),
    [grants, summaryGrantId]
  );

  useEffect(() => {
    if (!selectedGrant) {
      setEditDays('');
      setEditDefinitionId('');
      return;
    }
    setEditDays(String(Math.round(Number(selectedGrant.days_allocated || 0))));
    setEditDefinitionId(selectedGrant.definition_id ?? '');
  }, [selectedGrant?.id, selectedGrant?.days_allocated, selectedGrant?.definition_id]);

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
  }, [allocationLines, annualGlobalApproved, annualProjectPool, selectedGrant]);

  const reservedOnSelected = selectedGrant
    ? reservedOnGrant(allocationLines, selectedGrant.id)
    : 0;

  const sickDisplay = useMemo(() => {
    if (selectedGrant) {
      return { used: sickProjectApproved, total: sickProjectTotal };
    }
    return { used: sickGlobalApproved, total: sickProjectTotal };
  }, [selectedGrant, sickGlobalApproved, sickProjectApproved, sickProjectTotal]);

  const religiousDisplay = useMemo(() => {
    if (selectedGrant) {
      return { used: religiousProjectApproved, total: religiousProjectTotal };
    }
    return { used: religiousGlobalApproved, total: religiousProjectTotal };
  }, [selectedGrant, religiousGlobalApproved, religiousProjectApproved, religiousProjectTotal]);

  async function saveGrantAllocation() {
    if (!selectedGrant) return;
    const days = Number(editDays);
    if (!Number.isFinite(days) || days < 0) {
      toast.error('Enter a valid number of days');
      return;
    }

    setIsSavingGrant(true);
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectSlug)}/annual-grants/${encodeURIComponent(selectedGrant.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          days_allocated: days,
          definition_id: editDefinitionId === '' ? null : editDefinitionId,
        }),
      }
    );
    const payload = await response.json().catch(() => ({}));
    setIsSavingGrant(false);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to update fund');
      return;
    }

    toast.success('Fund allocation updated');
    router.refresh();
  }

  const footnote = selectedGrant
    ? `Annual shows approved days on “${selectedGrant.label}” vs that fund’s pool. Sick and religious show approved days in this project vs this team’s allowance.`
    : assignedGrants.length === 0
      ? 'Assign an annual fund template on Manage members to scope annual balance to a specific pool. Until then, annual “used” is across all projects.'
      : '';

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

            {scopeGrants.length > 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="balance-scope" className="text-xs text-muted-foreground">
                  Annual fund
                </Label>
                <select
                  id="balance-scope"
                  value={summaryGrantId ?? scopeGrants[0]?.id ?? ''}
                  onChange={(e) => setSummaryGrantId(e.target.value)}
                  className={selectClassName}
                >
                  {scopeGrants.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                      {g.grant_year != null ? ` (${g.grant_year})` : ''}
                      {g.definition_label ? ` · ${g.definition_label}` : ''}
                      {g.source ? ` · ${g.source}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No annual funds in this project yet.{' '}
                {canManage ? (
                  <Link href={projectPath(projectSlug, 'settings')} className="text-primary hover:underline">
                    Open project settings
                  </Link>
                ) : null}
              </p>
            )}

            {canManage && selectedGrant ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium">Edit allocation for {selectedGrant.label}</p>
                {fundDefinitions.length > 0 ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="member-grant-def" className="text-xs text-muted-foreground">
                      Fund template
                    </Label>
                    <select
                      id="member-grant-def"
                      value={editDefinitionId}
                      onChange={(e) => setEditDefinitionId(e.target.value)}
                      className={selectClassName}
                    >
                      <option value="">Not linked</option>
                      {fundDefinitions.map((def) => (
                        <option key={def.id} value={def.id}>
                          {def.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="member-grant-days" className="text-xs text-muted-foreground">
                    Allocated working days
                  </Label>
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      id="member-grant-days"
                      type="number"
                      min={0}
                      step={1}
                      value={editDays}
                      onChange={(e) => setEditDays(e.target.value)}
                      className="max-w-[8rem]"
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingGrant}
                      onClick={() => void saveGrantAllocation()}
                    >
                      {isSavingGrant ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {isSavingGrant ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Minimum {formatAllocatedDays(reservedOnSelected)} (pending + approved on this fund).
                    {selectedGrant.source === 'legacy_migration'
                      ? ' Legacy funds also sync the member’s annual total on Manage members.'
                      : null}
                  </p>
                </div>
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
                {selectedGrant ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatAllocatedDays(Math.max(0, annualDisplay.total - annualDisplay.used))} remaining
                  </p>
                ) : null}
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
                  {formatAllocatedDays(religiousDisplay.used)} /{' '}
                  {formatAllocatedDays(religiousDisplay.total)}
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
                onSelectSummaryGrant={(id) => {
                  if (id === null && scopeGrants[0]) {
                    setSummaryGrantId(scopeGrants[0].id);
                    return;
                  }
                  setSummaryGrantId(id);
                }}
              />
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
