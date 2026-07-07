'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_ORDER } from '@/lib/roadmap/status-theme';
import type { RoadmapMonth } from '@/lib/roadmap/months';
import type { RoadmapItem, RoadmapTeamWithMembers } from '@/lib/read/roadmap';
import type { RoadmapItemStatus } from '@/types/database';

const fieldClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function RoadmapItemDialog({
  mode,
  teams,
  months,
  item,
  defaultTeamId,
  onClose,
  onSaved,
  onDeleted,
}: {
  mode: 'create' | 'edit';
  teams: RoadmapTeamWithMembers[];
  months: RoadmapMonth[];
  item?: RoadmapItem;
  defaultTeamId?: string;
  onClose: () => void;
  onSaved: (item: RoadmapItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [teamId, setTeamId] = useState(item?.team_id ?? defaultTeamId ?? teams[0]?.id ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [status, setStatus] = useState<RoadmapItemStatus>(item?.status ?? 'planned');
  const [owner, setOwner] = useState(item?.owner ?? '');
  const [startMonth, setStartMonth] = useState(item?.start_month ?? '');
  const [endMonth, setEndMonth] = useState(item?.end_month ?? '');
  const [dependencies, setDependencies] = useState(item?.dependencies ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [busy, setBusy] = useState(false);

  const team = teams.find((t) => t.id === teamId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) return toast.error('Pick a team');
    if (!title.trim()) return toast.error('Enter a feature name');

    let start = startMonth || null;
    let end = endMonth || null;
    if (start && !end) end = start;
    if (end && !start) start = end;
    if (start && end && end < start) return toast.error('End month is before start month');

    const payload = {
      team_id: teamId,
      title: title.trim(),
      status,
      owner: owner.trim() || null,
      start_month: start,
      end_month: end,
      dependencies: dependencies.trim() || null,
      notes: notes.trim() || null,
    };

    setBusy(true);
    try {
      const res = await fetch(
        mode === 'create' ? '/api/roadmap' : `/api/roadmap/${item!.id}`,
        {
          method: mode === 'create' ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Could not save the feature');
      }
      const body = (await res.json()) as { item: RoadmapItem };
      toast.success(mode === 'create' ? 'Feature added' : 'Feature updated');
      onSaved(body.item);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the feature');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!item) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/roadmap/${item.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || 'Could not delete the feature');
      }
      toast.success('Feature deleted');
      onDeleted(item.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete the feature');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(100%-2rem,34rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="font-display text-xl">
              {mode === 'create' ? 'Add feature' : 'Edit feature'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" size="icon" variant="ghost" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rm-title">Feature name</Label>
              <Input
                id="rm-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Internationalization"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rm-team">Team</Label>
                <select
                  id="rm-team"
                  className={fieldClass}
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rm-status">Status</Label>
                <select
                  id="rm-status"
                  className={fieldClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RoadmapItemStatus)}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rm-owner">Owner</Label>
              <Input
                id="rm-owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder={team?.members[0]?.name ?? 'Owner name(s)'}
                list="rm-owner-options"
              />
              {team && team.members.length > 0 ? (
                <datalist id="rm-owner-options">
                  {team.members.map((m) => (
                    <option key={m.id} value={m.name} />
                  ))}
                </datalist>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="rm-start">Start month</Label>
                <select
                  id="rm-start"
                  className={fieldClass}
                  value={startMonth}
                  onChange={(e) => {
                    setStartMonth(e.target.value);
                    if (e.target.value && (!endMonth || endMonth < e.target.value)) {
                      setEndMonth(e.target.value);
                    }
                  }}
                >
                  <option value="">Unscheduled</option>
                  {months.map((m) => (
                    <option key={m.key} value={m.iso}>
                      {m.label} {m.year}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rm-end">End month</Label>
                <select
                  id="rm-end"
                  className={fieldClass}
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  disabled={!startMonth}
                >
                  <option value="">{startMonth ? 'Same as start' : 'Unscheduled'}</option>
                  {months
                    .filter((m) => !startMonth || m.iso >= startMonth)
                    .map((m) => (
                      <option key={m.key} value={m.iso}>
                        {m.label} {m.year}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rm-deps">Dependencies</Label>
              <Input
                id="rm-deps"
                value={dependencies}
                onChange={(e) => setDependencies(e.target.value)}
                placeholder="e.g. Waiting for Bloomteq Confluence documentation"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rm-notes">Notes</Label>
              <Input
                id="rm-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </div>

            <div className={cn('flex items-center gap-2 pt-2', mode === 'edit' && 'justify-between')}>
              {mode === 'edit' ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={handleDelete}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              ) : null}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  {mode === 'create' ? 'Add feature' : 'Save changes'}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
