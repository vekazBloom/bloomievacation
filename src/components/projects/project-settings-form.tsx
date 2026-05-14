'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectAnnualFundDefinitionsPanel } from '@/components/projects/project-annual-fund-definitions-panel';
import { ProjectAnnualGrantsOverview } from '@/components/projects/project-annual-grants-overview';
import { ProjectAnnualPolicyMilestones } from '@/components/projects/project-annual-policy-milestones';
import type { Database } from '@/types/database.generated';
import type { CarryOverPolicy } from '@/types/database';

type ProjectRow = Database['public']['Tables']['projects']['Row'];

export function ProjectSettingsForm({ project }: { project: ProjectRow }) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [threshold, setThreshold] = useState(String(project.vacation_threshold_percent ?? 50));
  const [resetMonth, setResetMonth] = useState(String(project.year_reset_month ?? 1));
  const [resetDay, setResetDay] = useState(String(project.year_reset_day ?? 1));
  const [accrualMonth, setAccrualMonth] = useState(String(project.annual_accrual_month ?? 1));
  const [accrualDay, setAccrualDay] = useState(String(project.annual_accrual_day ?? 1));
  const [firstUseMonth, setFirstUseMonth] = useState(
    project.annual_first_use_by_month != null ? String(project.annual_first_use_by_month) : ''
  );
  const [firstUseDay, setFirstUseDay] = useState(
    project.annual_first_use_by_day != null ? String(project.annual_first_use_by_day) : ''
  );
  const [carryOverPolicy, setCarryOverPolicy] = useState(
    (project.carry_over_policy ?? 'ask') as CarryOverPolicy
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  async function saveSettings() {
    setIsSaving(true);
    const response = await fetch(`/api/projects/${encodeURIComponent(project.slug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: description || null,
        vacation_threshold_percent: Number(threshold),
        year_reset_month: Number(resetMonth),
        year_reset_day: Number(resetDay),
        annual_accrual_month: Number(accrualMonth),
        annual_accrual_day: Number(accrualDay),
        annual_first_use_by_month:
          firstUseMonth.trim() === '' || firstUseDay.trim() === ''
            ? null
            : Number(firstUseMonth),
        annual_first_use_by_day:
          firstUseMonth.trim() === '' || firstUseDay.trim() === '' ? null : Number(firstUseDay),
        carry_over_policy: carryOverPolicy,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSaving(false);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to save settings');
      return;
    }

    toast.success('Project settings saved');
    router.refresh();
  }

  async function archiveProject() {
    const confirmed = window.confirm(
      project.is_archived
        ? 'Restore this project from archive?'
        : 'Archive this project? Members keep history, but it will be hidden from active lists.'
    );
    if (!confirmed) return;

    setIsArchiving(true);
    const response = await fetch(`/api/projects/${encodeURIComponent(project.slug)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archive: !project.is_archived }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsArchiving(false);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to update archive state');
      return;
    }

    toast.success(project.is_archived ? 'Project restored' : 'Project archived');
    router.push('/projects');
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-threshold">Vacation threshold (%)</Label>
            <Input
              id="project-threshold"
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(event) => setThreshold(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-description">Description</Label>
          <Input
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="accrual-month">Annual accrual (new days) — month</Label>
            <Input
              id="accrual-month"
              type="number"
              min={1}
              max={12}
              value={accrualMonth}
              onChange={(event) => setAccrualMonth(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accrual-day">Annual accrual — day</Label>
            <Input
              id="accrual-day"
              type="number"
              min={1}
              max={31}
              value={accrualDay}
              onChange={(event) => setAccrualDay(event.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Each year on this date a new annual fund opens (after the year-reset job runs). Defaults match
          January 1 if unchanged.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="first-use-month">First-period use-by (optional) — month</Label>
            <Input
              id="first-use-month"
              type="number"
              min={1}
              max={12}
              placeholder="e.g. 7"
              value={firstUseMonth}
              onChange={(event) => setFirstUseMonth(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="first-use-day">First-period use-by — day</Label>
            <Input
              id="first-use-day"
              type="number"
              min={1}
              max={31}
              placeholder="e.g. 1"
              value={firstUseDay}
              onChange={(event) => setFirstUseDay(event.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave both fields empty so new funds never get an automatic expiry date. When you set month and
          day, each year&apos;s fund expires on that calendar date in the following year.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="reset-month">Year reset month</Label>
            <Input
              id="reset-month"
              type="number"
              min={1}
              max={12}
              value={resetMonth}
              onChange={(event) => setResetMonth(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-day">Year reset day</Label>
            <Input
              id="reset-day"
              type="number"
              min={1}
              max={31}
              value={resetDay}
              onChange={(event) => setResetDay(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="carry-over-policy">Carry-over policy</Label>
            <select
              id="carry-over-policy"
              value={carryOverPolicy}
              onChange={(event) => setCarryOverPolicy(event.target.value as CarryOverPolicy)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ask">Ask at year end</option>
              <option value="auto_transfer">Auto transfer</option>
              <option value="auto_lose">Auto lose</option>
            </select>
          </div>
        </div>

        <ProjectAnnualPolicyMilestones
          yearResetMonth={Number(resetMonth) || 1}
          yearResetDay={Number(resetDay) || 1}
          annualAccrualMonth={Number(accrualMonth) || 1}
          annualAccrualDay={Number(accrualDay) || 1}
          annualFirstUseByMonth={
            firstUseMonth.trim() === '' || firstUseDay.trim() === ''
              ? null
              : Number(firstUseMonth) || null
          }
          annualFirstUseByDay={
            firstUseMonth.trim() === '' || firstUseDay.trim() === '' ? null : Number(firstUseDay) || null
          }
        />

        <div className="space-y-2 border-t border-border pt-4">
          <ProjectAnnualFundDefinitionsPanel projectSlug={project.slug} />
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold text-foreground">Team annual funds (read-only)</h3>
          <p className="text-xs text-muted-foreground">
            All entitlement rows for the team (active, upcoming, ended). Create and edit reusable fund
            definitions above; on <strong>Manage members</strong>, each person links their legacy annual pool
            to a definition. Legacy <strong>allocated</strong> days stay in sync with member annual totals;
            other grant types are managed by the year-reset job.
          </p>
          <ProjectAnnualGrantsOverview projectId={project.id} />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={saveSettings} disabled={isSaving || isArchiving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save settings
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={archiveProject}
            disabled={isSaving || isArchiving}
          >
            {isArchiving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {project.is_archived ? 'Restore project' : 'Archive project'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
