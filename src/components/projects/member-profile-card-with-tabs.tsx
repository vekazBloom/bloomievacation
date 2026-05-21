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
import type { MemberFundBalanceRow } from '@/lib/projects/overview-fund-stats';
import { getInitials } from '@/lib/utils';
import { projectPath } from '@/lib/projects/paths';

function balanceForFundSelection(
  fundKey: string | null,
  memberUserId: string,
  byDefinition: Record<string, Record<string, MemberFundBalanceRow>>,
  byGrantId: Record<string, MemberFundBalanceRow>
): MemberFundBalanceRow | null {
  if (!fundKey) return null;
  if (fundKey.startsWith('grant:')) {
    return byGrantId[fundKey.slice('grant:'.length)] ?? null;
  }
  return byDefinition[fundKey]?.[memberUserId] ?? null;
}

const selectClassName =
  'flex h-9 max-w-md w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

type AnnualFundOption = {
  key: string;
  label: string;
  grantId: string | null;
};

function pickPrimaryGrantForDefinition(grantList: MemberFundGrant[]): MemberFundGrant {
  const nonLegacy = grantList.filter((g) => g.source !== 'legacy_migration');
  if (nonLegacy.length > 0) {
    return [...nonLegacy].sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
  }
  const legacy = grantList.find((g) => g.source === 'legacy_migration');
  if (legacy) return legacy;
  return [...grantList].sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0];
}

function buildAnnualFundOptions(
  grants: MemberFundGrant[],
  fundDefinitions: Array<{ id: string; label: string }>,
  assignedTemplateIds: string[]
): AnnualFundOption[] {
  const defLabelById = new Map(fundDefinitions.map((d) => [d.id, d.label]));
  const byDefinition = new Map<string, MemberFundGrant[]>();
  const unlinked: MemberFundGrant[] = [];

  for (const grant of grants) {
    if (grant.definition_id) {
      const list = byDefinition.get(grant.definition_id) || [];
      list.push(grant);
      byDefinition.set(grant.definition_id, list);
    } else {
      unlinked.push(grant);
    }
  }

  const definitionIds = [
    ...new Set([
      ...assignedTemplateIds.filter(Boolean),
      ...(grants.map((g) => g.definition_id).filter(Boolean) as string[]),
    ]),
  ];

  const options: AnnualFundOption[] = [];
  const seenKeys = new Set<string>();

  for (const definitionId of definitionIds) {
    const grantList = byDefinition.get(definitionId) || [];
    const grant = grantList.length > 0 ? pickPrimaryGrantForDefinition(grantList) : null;
    const label = defLabelById.get(definitionId) || grant?.definition_label || grant?.label || 'Annual fund';
    options.push({ key: definitionId, label, grantId: grant?.id ?? null });
    seenKeys.add(definitionId);
  }

  for (const [definitionId, grantList] of byDefinition) {
    if (seenKeys.has(definitionId)) continue;
    const grant = pickPrimaryGrantForDefinition(grantList);
    const label =
      defLabelById.get(definitionId) || grant.definition_label || grant.label || 'Annual fund';
    options.push({ key: definitionId, label, grantId: grant.id });
    seenKeys.add(definitionId);
  }

  for (const grant of unlinked) {
    options.push({
      key: `grant:${grant.id}`,
      label: grant.label || 'Annual fund',
      grantId: grant.id,
    });
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

export function MemberProfileCardWithTabs({
  projectSlug,
  projectMemberId,
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
  attributedGrantByRequestId,
  memberFundBalanceByDefinition,
  memberFundBalanceByGrantId,
  memberUserId,
  requests,
  canReview,
  canManage,
  canEditLeaveBalances,
  fundDefinitions,
  currentUserId,
}: {
  projectSlug: string;
  projectMemberId: string;
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
  attributedGrantByRequestId: Record<string, string>;
  memberFundBalanceByDefinition: Record<string, Record<string, MemberFundBalanceRow>>;
  memberFundBalanceByGrantId: Record<string, MemberFundBalanceRow>;
  memberUserId: string;
  requests: any[];
  canReview: boolean;
  canManage: boolean;
  canEditLeaveBalances: boolean;
  fundDefinitions: Array<{ id: string; label: string }>;
  currentUserId: string;
}) {
  const router = useRouter();

  const fundOptions = useMemo(
    () => buildAnnualFundOptions(grants, fundDefinitions, assignedTemplateIds),
    [grants, fundDefinitions, assignedTemplateIds]
  );

  const [selectedFundKey, setSelectedFundKey] = useState<string | null>(null);
  const [editDays, setEditDays] = useState('');
  const [editSickTotal, setEditSickTotal] = useState('');
  const [editReligiousTotal, setEditReligiousTotal] = useState('');
  const [isSavingGrant, setIsSavingGrant] = useState(false);
  const [isSavingAllowances, setIsSavingAllowances] = useState(false);

  useEffect(() => {
    setEditSickTotal(String(Math.round(sickProjectTotal)));
    setEditReligiousTotal(String(Math.round(religiousProjectTotal)));
  }, [sickProjectTotal, religiousProjectTotal]);

  useEffect(() => {
    if (fundOptions.length === 0) {
      setSelectedFundKey(null);
      return;
    }
    setSelectedFundKey((prev) => {
      if (prev && fundOptions.some((o) => o.key === prev)) return prev;
      const assigned = assignedTemplateIds.find((id) => fundOptions.some((o) => o.key === id));
      return assigned ?? fundOptions[0].key;
    });
  }, [fundOptions, assignedTemplateIds.join('|')]);

  const selectedFundOption = useMemo(
    () => fundOptions.find((o) => o.key === selectedFundKey) ?? null,
    [fundOptions, selectedFundKey]
  );

  const selectedGrant = useMemo(() => {
    if (!selectedFundOption?.grantId) return null;
    return grants.find((g) => g.id === selectedFundOption.grantId) ?? null;
  }, [grants, selectedFundOption]);

  const summaryGrantId = selectedGrant?.id ?? null;

  useEffect(() => {
    if (!selectedGrant) {
      setEditDays('');
      return;
    }
    setEditDays(String(Math.round(Number(selectedGrant.days_allocated || 0))));
  }, [selectedGrant?.id, selectedGrant?.days_allocated]);

  const selectedFundBalance = useMemo(
    () =>
      balanceForFundSelection(
        selectedFundKey,
        memberUserId,
        memberFundBalanceByDefinition,
        memberFundBalanceByGrantId
      ),
    [selectedFundKey, memberUserId, memberFundBalanceByDefinition, memberFundBalanceByGrantId]
  );

  const annualDisplay = useMemo(() => {
    if (selectedFundBalance) {
      return { used: selectedFundBalance.used, total: selectedFundBalance.total };
    }
    return {
      used: annualGlobalApproved,
      total: annualProjectPool,
    };
  }, [selectedFundBalance, annualGlobalApproved, annualProjectPool]);

  const reservedOnSelected = selectedFundBalance?.reserved ?? 0;

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
    if (!selectedFundOption?.grantId) {
      toast.error('This fund is not set up for this member yet. Save fund assignments on Manage members first.');
      return;
    }
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
        body: JSON.stringify({ days_allocated: days }),
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

  async function saveTeamAllowances() {
    const sick = Number(editSickTotal);
    const religious = Number(editReligiousTotal);
    if (!Number.isFinite(sick) || sick < 0 || !Number.isFinite(religious) || religious < 0) {
      toast.error('Enter valid sick and religious day totals');
      return;
    }

    setIsSavingAllowances(true);
    const response = await fetch(
      `/api/projects/${encodeURIComponent(projectSlug)}/members/${encodeURIComponent(projectMemberId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sick_leave_total: Math.round(sick),
          religious_leave_total: Math.round(religious),
        }),
      }
    );
    const payload = await response.json().catch(() => ({}));
    setIsSavingAllowances(false);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to update allowances');
      return;
    }

    toast.success('Sick and religious totals updated');
    router.refresh();
  }

  const selectedFundLabel = selectedFundOption?.label ?? null;

  const footnote = selectedFundLabel
    ? `Annual balance is for “${selectedFundLabel}”. Sick and religious use this project’s team allowance.`
    : fundOptions.length === 0
      ? 'Assign annual funds on Manage members so this member has a pool here.'
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

            {fundOptions.length > 0 ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="balance-scope" className="text-xs text-muted-foreground">
                    Annual fund
                  </Label>
                  <select
                    id="balance-scope"
                    value={selectedFundKey ?? fundOptions[0]?.key ?? ''}
                    onChange={(e) => setSelectedFundKey(e.target.value)}
                    className={selectClassName}
                  >
                    {fundOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {canEditLeaveBalances && selectedGrant ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="member-grant-days" className="text-xs text-muted-foreground">
                        Allocated days
                      </Label>
                      <Input
                        id="member-grant-days"
                        type="number"
                        min={0}
                        step={1}
                        value={editDays}
                        onChange={(e) => setEditDays(e.target.value)}
                        className="max-w-[8rem]"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isSavingGrant}
                      onClick={() => void saveGrantAllocation()}
                    >
                      {isSavingGrant ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {isSavingGrant ? 'Saving…' : 'Save fund'}
                    </Button>
                  </div>
                ) : null}

                {canEditLeaveBalances && selectedGrant ? (
                  <p className="text-xs text-muted-foreground">
                    Minimum {formatAllocatedDays(reservedOnSelected)} already booked on this fund.
                    {selectedGrant.source === 'legacy_migration'
                      ? ' Saving also updates the legacy annual total for this project.'
                      : null}
                  </p>
                ) : null}
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

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Annual</p>
                {selectedFundLabel ? (
                  <p className="mt-0.5 text-xs font-normal normal-case text-muted-foreground line-clamp-2">
                    {selectedFundLabel}
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

            {canEditLeaveBalances ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-3">
                <p className="text-xs font-medium text-foreground">Edit allowances (system admin)</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="member-sick-total" className="text-xs text-muted-foreground">
                      Sick days (project)
                    </Label>
                    <Input
                      id="member-sick-total"
                      type="number"
                      min={0}
                      step={1}
                      value={editSickTotal}
                      onChange={(e) => setEditSickTotal(e.target.value)}
                      className="max-w-[8rem]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="member-religious-total" className="text-xs text-muted-foreground">
                      Religious days (project)
                    </Label>
                    <Input
                      id="member-religious-total"
                      type="number"
                      min={0}
                      step={1}
                      value={editReligiousTotal}
                      onChange={(e) => setEditReligiousTotal(e.target.value)}
                      className="max-w-[8rem]"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isSavingAllowances}
                    onClick={() => void saveTeamAllowances()}
                  >
                    {isSavingAllowances ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSavingAllowances ? 'Saving…' : 'Save sick & religious'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sick and religious apply to this project for everyone on the team. Annual days are edited per
                  fund above.
                </p>
              </div>
            ) : null}

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
                attributedGrantByRequestId={attributedGrantByRequestId}
                selectedSummaryGrantId={summaryGrantId}
                onSelectSummaryGrant={(id) => {
                  if (!id) return;
                  const match = fundOptions.find((o) => o.grantId === id);
                  if (match) setSelectedFundKey(match.key);
                }}
              />
            </div>
          }
        />
      </CardContent>
    </Card>
  );
}
