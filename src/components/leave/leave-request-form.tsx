'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { fundPeriodLabelForAnchor, fundSourceShortLabel } from '@/lib/leave/fund-period-label';
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

  const anchorDate = startDate || todayIso();

  const grantMeta = useMemo(() => new Map(allGrants?.map((g) => [g.id, g]) ?? []), [allGrants]);

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
    async function loadGrants() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data, error } = await supabase
        .from('annual_entitlement_grants')
        .select('id, label, grant_year, valid_from, valid_to, source, days_allocated')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('valid_from', { ascending: true });
      if (cancelled) return;
      if (error) {
        setAllGrants([]);
        return;
      }
      setAllGrants((data || []) as GrantRow[]);
    }
    void loadGrants();
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

  useEffect(() => {
    if (type !== 'annual' || !preview?.annualGrants || preview.annualGrants.requiresSplit) return;
    const el = preview.annualGrants.eligible;
    if (el.length === 1) {
      setSelectedGrantId((prev) => (prev && el.some((x) => x.id === prev) ? prev : el[0].id));
    } else if (el.length === 0) {
      setSelectedGrantId(null);
    }
  }, [preview, type]);

  function fundOptionLabel(g: GrantRow): string {
    const period = fundPeriodLabelForAnchor(anchorDate, g.valid_from, g.valid_to);
    const src = fundSourceShortLabel(g.source);
    return `${g.label || 'Fund'} [${period} · ${src}]`;
  }

  function isGrantDisabledForPick(g: GrantRow): boolean {
    if (!preview?.annualGrants || preview.annualGrants.requiresSplit) return false;
    const eligible = preview.annualGrants.eligible;
    if (eligible.length === 0) return true;
    if (eligible.length >= 2) return false;
    return !eligible.some((e) => e.id === g.id);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

    if (type === 'annual' && preview?.annualGrants?.requiresSplit) {
      const eligible = preview.annualGrants.eligible;
      const parts = eligible.map((g) => ({
        grantId: g.id,
        workingDays: Number(fundSplit[g.id] || 0),
      }));
      const sum = parts.reduce((s, p) => s + p.workingDays, 0);
      if (Math.abs(sum - preview.workingDays) > 0.02) {
        setIsSubmitting(false);
        return toast.error(
          `Working days split (${sum}) must equal ${preview.workingDays} for this date range.`
        );
      }
      if (parts.some((p) => p.workingDays <= 0)) {
        setIsSubmitting(false);
        return toast.error('Each fund must use a positive number of days.');
      }
      body.annualAllocations = parts;
    } else if (
      type === 'annual' &&
      preview?.annualGrants &&
      !preview.annualGrants.requiresSplit &&
      preview.workingDays > 0
    ) {
      const eligible = preview.annualGrants.eligible;
      if (eligible.length === 1) {
        const gid =
          selectedGrantId && eligible.some((e) => e.id === selectedGrantId)
            ? selectedGrantId
            : eligible[0].id;
        body.annualAllocations = [{ grantId: gid, workingDays: preview.workingDays }];
      }
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

  const showFundDropdown =
    type === 'annual' && allGrants && allGrants.length > 0 && !preview?.annualGrants?.requiresSplit;

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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start-date">Start date</Label>
          <Input id="start-date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">End date</Label>
          <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>

      {showFundDropdown ? (
        <div className="space-y-2">
          <Label htmlFor="annual-fund">Annual fund</Label>
          <select
            id="annual-fund"
            value={
              preview?.annualGrants &&
              !preview.annualGrants.requiresSplit &&
              preview.annualGrants.eligible.length === 1
                ? selectedGrantId ?? preview.annualGrants.eligible[0].id
                : selectedGrantId ?? ''
            }
            onChange={(e) => setSelectedGrantId(e.target.value === '' ? null : e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {preview?.annualGrants?.eligible.length !== 1 ? (
              <option value="">Select fund…</option>
            ) : null}
            {(allGrants || []).map((g) => (
              <option key={g.id} value={g.id} disabled={isGrantDisabledForPick(g)}>
                {fundOptionLabel(g)}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            <strong>Active</strong> = covers your start date; <strong>Future</strong> = fund starts after that date;{' '}
            <strong>Past</strong> = fund already ended before that date. Only funds that cover the start date can be
            chosen (labels use {startDate ? 'your start date' : 'today'} until you pick dates).
          </p>
        </div>
      ) : null}

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
              ) : preview.annualGrants.eligible.length === 0 ? (
                <div className="space-y-1 border-t border-border pt-3 text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium">No fund covers the first day</p>
                  <p>
                    Change the start date or ask an admin to adjust fund validity so an annual pool covers the
                    first day of leave.
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
                    <strong>{preview.workingDays}</strong> working day(s) will be booked from the fund you selected
                    above (must be <strong>Active</strong> for your start date).
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        Submit request
      </Button>
    </form>
  );
}
