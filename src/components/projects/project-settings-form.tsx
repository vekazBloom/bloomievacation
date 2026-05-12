'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
