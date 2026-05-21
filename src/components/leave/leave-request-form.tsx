'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { resolveGrantBookableEnd, type ProjectFirstUsePolicy } from '@/lib/leave/entitlement-grants';
import { fundPeriodLabelForAnchor, fundSourceShortLabel } from '@/lib/leave/fund-period-label';
import {
  formatSickLeavePoolLabel,
  type SickLeavePoolOption,
} from '@/lib/leave/sick-leave-pools';
import { projectPath } from '@/lib/projects/paths';

type AnnualGrantPreview = {
  eligible: Array<{
    id: string;
    label: string;
    grant_year: number | null;
    valid_from: string;
    valid_to: string | null;
    remaining: number;
  }>;
  requiresSplit: boolean;
};

type PreviewState = {
  workingDays: number;
  exceedsThreshold: boolean;
  overlappingMembers: number;
  annualGrants: AnnualGrantPreview | null;
  annualGrantRowCount: number;
} | null;

type GrantRow = {
  id: string;
  label: string;
  grant_year: number | null;
  valid_from: string;
  valid_to: string | null;
  source: string;
  days_allocated: number;
  project_id?: string;
};

function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function LeaveRequestForm({
  projectId,
  projectSlug,
}: {
  projectId: string;
  projectSlug: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [type, setType] = useState<'annual' | 'sick'>('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [fundSplit, setFundSplit] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allGrants, setAllGrants] = useState<GrantRow[] | null>(null);
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [sickPools, setSickPools] = useState<SickLeavePoolOption[]>([]);
  const [selectedSickPoolId, setSelectedSickPoolId] = useState<string>('');
  const [firstUsePolicy, setFirstUsePolicy] = useState<ProjectFirstUsePolicy>({
    firstUseMonth: null,
    firstUseDay: null,
  });

  const anchorDate = startDate || todayIso();

  const grantMeta = useMemo(() => new Map(allGrants?.map((g) => [g.id, g]) ?? []), [allGrants]);

  const selectedGrant = selectedGrantId ? grantMeta.get(selectedGrantId) ?? null : null;
  const selectedSickPool = sickPools.find((pool) => pool.projectId === selectedSickPoolId) ?? null;

  const endDateMin = startDate || undefined;

  const eligibleIdsKey = useMemo(
    () =>
      (preview?.annualGrants?.eligible || [])
        .map((g) => g.id)
        .sort()
        .join(','),
    [preview?.annualGrants?.eligible]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadFundOptions() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const [{ data: grantData, error }, { data: projectData }, { data: memberships }] = await Promise.all([
        supabase
          .from('annual_entitlement_grants')
          .select('id, label, grant_year, valid_from, valid_to, source, days_allocated, project_id')
          .eq('user_id', user.id)
          .order('valid_from', { ascending: true }),
        supabase
          .from('projects')
          .select('annual_first_use_by_month, annual_first_use_by_day')
          .eq('id', projectId)
          .maybeSingle(),
        supabase
          .from('project_members')
          .select('project_id, sick_leave_total, sick_leave_used, projects(name)')
          .eq('user_id', user.id),
      ]);

      if (cancelled) return;
      if (error) {
        setAllGrants([]);
      } else {
        setAllGrants((grantData || []) as GrantRow[]);
      }
      setFirstUsePolicy({
        firstUseMonth: (projectData?.annual_first_use_by_month as number | null) ?? null,
        firstUseDay: (projectData?.annual_first_use_by_day as number | null) ?? null,
      });

      const pools: SickLeavePoolOption[] = (memberships || []).map((row) => {
        const project = row.projects as { name?: string } | { name?: string }[] | null;
        const name = Array.isArray(project) ? project[0]?.name : project?.name;
        const total = Number(row.sick_leave_total ?? 0);
        const used = Number(row.sick_leave_used ?? 0);
        return {
          projectId: row.project_id as string,
          projectName: name || 'Project',
          sickTotal: total,
          sickUsed: used,
          sickRemaining: Math.max(0, total - used),
        };
      });
      setSickPools(pools);
      setSelectedSickPoolId((prev) => {
        if (prev && pools.some((p) => p.projectId === prev)) return prev;
        if (pools.some((p) => p.projectId === projectId)) return projectId;
        return pools[0]?.projectId ?? '';
      });
    }
    void loadFundOptions();
    return () => {
      cancelled = true;
    };
  }, [projectId, supabase]);

  useEffect(() => {
    if (!startDate || !endDate) {
      setPreview(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      const leaveParam = type === 'annual' ? '&leaveType=annual' : '';
      const response = await fetch(
        `/api/leave-requests/preview?projectId=${projectId}&startDate=${startDate}&endDate=${endDate}${leaveParam}`
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) return;
      setPreview({
        workingDays: payload.workingDays,
        exceedsThreshold: payload.overlap?.exceedsThreshold,
        overlappingMembers: payload.overlap?.overlappingMembers,
        annualGrants: payload.annualGrants ?? null,
        annualGrantRowCount: Number(payload.annualGrantRowCount) || 0,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [projectId, startDate, endDate, type]);

  useEffect(() => {
    const ag = preview?.annualGrants;
    if (!ag?.requiresSplit || !preview?.workingDays || ag.eligible.length === 0) {
      setFundSplit({});
      return;
    }
    const wd = preview.workingDays;
    const n = ag.eligible.length;
    const cents = Math.round(Number(wd) * 10);
    const each = Math.floor(cents / n);
    const rem = cents % n;
    const next: Record<string, string> = {};
    for (let i = 0; i < ag.eligible.length; i += 1) {
      const c = each + (i < rem ? 1 : 0);
      next[ag.eligible[i].id] = String(c / 10);
    }
    setFundSplit(next);
  }, [preview?.workingDays, preview?.annualGrants?.requiresSplit, eligibleIdsKey]);

  function fundOptionLabel(g: GrantRow): string {
    const bookableTo = resolveGrantBookableEnd(g, firstUsePolicy.firstUseMonth, firstUsePolicy.firstUseDay);
    const period = fundPeriodLabelForAnchor(anchorDate, g.valid_from, bookableTo);
    const src = fundSourceShortLabel(g.source);
    return `${g.label || 'Fund'} [${period} · ${src}]`;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (type === 'annual' && allGrants && allGrants.length > 0) {
      if (preview?.annualGrants?.requiresSplit) {
        const eligible = preview.annualGrants.eligible;
        const parts = eligible.map((g) => ({
          grantId: g.id,
          workingDays: Number(fundSplit[g.id] || 0),
        }));
        const sum = parts.reduce((s, p) => s + p.workingDays, 0);
        if (Math.abs(sum - preview.workingDays) > 0.02) {
          return toast.error(
            `Working days split (${sum}) must equal ${preview.workingDays} for this date range.`
          );
        }
        if (parts.some((p) => p.workingDays <= 0)) {
          return toast.error('Each fund must use a positive number of days.');
        }
      } else if (!selectedGrantId) {
        return toast.error('Select which annual fund to use.');
      }
    }

    if (type === 'sick') {
      if (sickPools.length === 0) {
        return toast.error('No sick leave pool is available for your account.');
      }
      if (!selectedSickPoolId) {
        return toast.error('Select which sick leave pool (project) to use.');
      }
    }

    setIsSubmitting(true);

    let attachmentUrl: string | null = null;
    if (attachmentFile) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsSubmitting(false);
        return toast.error('You must be signed in to upload an attachment');
      }

      const path = `${user.id}/${Date.now()}-${attachmentFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('sick-leave-attachments')
        .upload(path, attachmentFile);
      if (uploadError) {
        setIsSubmitting(false);
        return toast.error(uploadError.message);
      }
      attachmentUrl = path;
    }

    const body: Record<string, unknown> = {
      projectId,
      type,
      startDate,
      endDate,
      reason: reason || null,
      attachmentUrl,
    };

    if (type === 'sick') {
      body.balanceProjectId = selectedSickPoolId;
    }

    if (type === 'annual' && preview?.annualGrants?.requiresSplit) {
      const eligible = preview.annualGrants.eligible;
      body.annualAllocations = eligible.map((g) => ({
        grantId: g.id,
        workingDays: Number(fundSplit[g.id] || 0),
      }));
    } else if (
      type === 'annual' &&
      preview?.annualGrants &&
      !preview.annualGrants.requiresSplit &&
      preview.workingDays > 0 &&
      selectedGrantId
    ) {
      body.annualAllocations = [{ grantId: selectedGrantId, workingDays: preview.workingDays }];
    }

    const response = await fetch('/api/leave-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSubmitting(false);

    if (!response.ok) return toast.error(payload.error || 'Failed to submit request');
    toast.success('Leave request submitted');
    router.push(projectPath(projectSlug, 'requests'));
    router.refresh();
  }

  const showAnnualFundDropdown =
    type === 'annual' && allGrants && allGrants.length > 0 && !preview?.annualGrants?.requiresSplit;

  const showSickFundDropdown = type === 'sick' && sickPools.length > 0;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="leave-type">Leave type</Label>
        <select
          id="leave-type"
          value={type}
          onChange={(event) => setType(event.target.value as 'annual' | 'sick')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="annual">Annual leave</option>
          <option value="sick">Sick leave</option>
        </select>
      </div>

      {showAnnualFundDropdown ? (
        <div className="space-y-2">
          <Label htmlFor="annual-fund">
            Annual fund <span className="text-destructive">*</span>
          </Label>
          <select
            id="annual-fund"
            required
            value={selectedGrantId ?? ''}
            onChange={(e) => setSelectedGrantId(e.target.value === '' ? null : e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select fund…
            </option>
            {(allGrants || []).map((g) => (
              <option key={g.id} value={g.id}>
                {fundOptionLabel(g)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            You must choose a fund before submitting. Days are taken from that fund, not from a global
            team total.
          </p>
        </div>
      ) : null}

      {showSickFundDropdown ? (
        <div className="space-y-2">
          <Label htmlFor="sick-fund">
            Sick leave pool <span className="text-destructive">*</span>
          </Label>
          <select
            id="sick-fund"
            required
            value={selectedSickPoolId}
            onChange={(e) => setSelectedSickPoolId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="" disabled>
              Select project pool…
            </option>
            {sickPools.map((pool) => (
              <option key={pool.projectId} value={pool.projectId}>
                {formatSickLeavePoolLabel(pool)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Choose which project&apos;s sick allowance this request uses. You cannot book against a generic
            global pool without selecting one.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start-date">Start date</Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">End date</Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={endDateMin}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>

      {type === 'sick' ? (
        <div className="space-y-2">
          <Label htmlFor="attachment">Doctor&apos;s note (optional)</Label>
          <Input
            id="attachment"
            type="file"
            accept="image/*,.pdf"
            onChange={(event) => setAttachmentFile(event.target.files?.[0] || null)}
          />
        </div>
      ) : null}

      {preview ? (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm space-y-3">
          <p>Working days: {preview.workingDays}</p>
          {preview.exceedsThreshold ? (
            <p className="text-amber-700">
              Warning: {preview.overlappingMembers} colleagues already have approved annual leave in this period.
            </p>
          ) : null}

          {type === 'annual' && preview.annualGrants ? (
            <>
              {(preview.annualGrantRowCount ?? 0) === 0 ? (
                <div className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Annual allowance</p>
                  <p>
                    This project does not use split annual funds yet. Days count against your team annual total
                    (see your profile).
                  </p>
                </div>
              ) : preview.annualGrants.requiresSplit ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="font-medium">Split across annual funds</p>
                  <p className="text-xs text-muted-foreground">
                    More than one fund is valid on the start date. Enter how many working days to take from each
                    fund (must sum to {preview.workingDays}).
                  </p>
                  {preview.annualGrants.eligible.map((g) => {
                    const meta = grantMeta.get(g.id);
                    const period = fundPeriodLabelForAnchor(startDate || todayIso(), g.valid_from, g.valid_to);
                    const src = meta ? fundSourceShortLabel(meta.source) : 'Fund';
                    return (
                      <div key={g.id} className="flex flex-wrap items-end gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <Label htmlFor={`fund-${g.id}`} className="text-xs font-normal text-muted-foreground">
                            {g.label || 'Fund'}
                            {g.grant_year != null ? ` (${g.grant_year})` : ''}{' '}
                            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                              {period} · {src}
                            </span>{' '}
                            — up to {g.remaining.toFixed(1)} d left
                          </Label>
                          <Input
                            id={`fund-${g.id}`}
                            type="number"
                            step="0.1"
                            min={0.1}
                            required
                            value={fundSplit[g.id] ?? ''}
                            onChange={(e) => setFundSplit((prev) => ({ ...prev, [g.id]: e.target.value }))}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="font-medium">Booking summary</p>
                  <p className="text-sm text-muted-foreground">
                    <strong>{preview.workingDays}</strong> working day(s) from{' '}
                    <strong>{selectedGrant?.label ?? 'select a fund above'}</strong>.
                  </p>
                </div>
              )}
            </>
          ) : null}

          {type === 'sick' && selectedSickPool ? (
            <div className="space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
              <p className="font-medium">Sick leave pool</p>
              <p>
                <strong>{preview.workingDays}</strong> working day(s) from{' '}
                <strong>{selectedSickPool.projectName}</strong> ({selectedSickPool.sickRemaining.toFixed(0)}{' '}
                days remaining on that pool).
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        Submit request
      </Button>
    </form>
  );
}
