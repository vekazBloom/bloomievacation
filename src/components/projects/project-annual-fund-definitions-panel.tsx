'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatPolicyDate } from '@/lib/leave/annual-policy-dates';

type Definition = {
  id: string;
  label: string;
  grant_year: number | null;
  valid_from: string;
  valid_to: string | null;
  sort_order: number;
};

function parseLocalDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function ProjectAnnualFundDefinitionsPanel({ projectSlug }: { projectSlug: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Definition[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [newLabel, setNewLabel] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newFrom, setNewFrom] = useState('');
  const [newTo, setNewTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/annual-fund-definitions`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || 'Failed to load fund definitions');
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(payload.definitions || []);
    setLoading(false);
  }, [projectSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDefinition() {
    if (!newLabel.trim() || !newFrom) {
      toast.error('Label and valid from are required');
      return;
    }
    setCreating(true);
    const body: Record<string, unknown> = {
      label: newLabel.trim(),
      valid_from: newFrom,
      grant_year: newYear.trim() === '' ? null : Number(newYear),
      sort_order: (rows?.length ?? 0),
    };
    if (newTo.trim() !== '') body.valid_to = newTo.trim();
    const res = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/annual-fund-definitions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) {
      toast.error(payload.error || 'Failed to create');
      return;
    }
    toast.success('Fund definition created');
    setNewLabel('');
    setNewYear('');
    setNewFrom('');
    setNewTo('');
    await load();
    router.refresh();
  }

  async function saveRow(
    row: Definition,
    draft: { label: string; grant_year: number | null; valid_from: string; valid_to_input: string }
  ) {
    setSavingId(row.id);
    const body: Record<string, unknown> = {
      label: draft.label,
      valid_from: draft.valid_from,
      valid_to: draft.valid_to_input.trim() === '' ? null : draft.valid_to_input.trim(),
      grant_year: draft.grant_year,
    };
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectSlug)}/annual-fund-definitions/${encodeURIComponent(row.id)}`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    );
    const payload = await res.json().catch(() => ({}));
    setSavingId(null);
    if (!res.ok) {
      toast.error(payload.error || 'Failed to save');
      return;
    }
    toast.success('Definition updated (linked member grants refreshed)');
    setEditingId(null);
    await load();
    router.refresh();
  }

  async function deleteRow(id: string) {
    if (!window.confirm('Delete this fund definition? Member grants that pointed to it lose the link.')) return;
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectSlug)}/annual-fund-definitions/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(payload.error || 'Failed to delete');
      return;
    }
    toast.success('Definition deleted');
    await load();
    router.refresh();
  }

  if (loading && rows === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading fund definitions…
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/15 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Annual fund definitions (project-wide)</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Create reusable funds (name + validity) here. On <strong>Manage members</strong>, each person
          picks one definition for their <strong>legacy</strong> annual pool — only the annual total is
          edited per member; dates and label follow the selected fund.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Editing a definition updates every grant still linked to it (same label and dates everywhere).
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Label</th>
              <th className="px-3 py-2 font-medium">Year</th>
              <th className="px-3 py-2 font-medium">Valid from</th>
              <th className="px-3 py-2 font-medium">Valid to</th>
              <th className="px-3 py-2 font-medium w-28">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(rows || []).map((row) =>
              editingId === row.id ? (
                <DefinitionEditRow
                  key={row.id}
                  row={row}
                  disabled={savingId === row.id}
                  onCancel={() => setEditingId(null)}
                  onSave={(draft) => void saveRow(row, draft)}
                />
              ) : (
                <tr key={row.id} className="bg-card/80">
                  <td className="px-3 py-2 font-medium">{row.label}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.grant_year ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatPolicyDate(parseLocalDay(row.valid_from))}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {row.valid_to ? formatPolicyDate(parseLocalDay(row.valid_to)) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setEditingId(row.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => void deleteRow(row.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border border-dashed border-border bg-card/50 p-4 space-y-3">
        <p className="text-xs font-medium text-foreground">Add definition</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="def-new-label">Label</Label>
            <Input id="def-new-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Godišnji 2025" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="def-new-year">Grant year (optional)</Label>
            <Input id="def-new-year" type="number" value={newYear} onChange={(e) => setNewYear(e.target.value)} placeholder="2025" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="def-new-from">Valid from</Label>
            <Input id="def-new-from" type="date" value={newFrom} onChange={(e) => setNewFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="def-new-to">Valid to (optional)</Label>
            <Input id="def-new-to" type="date" value={newTo} onChange={(e) => setNewTo(e.target.value)} />
          </div>
        </div>
        <Button type="button" size="sm" onClick={() => void createDefinition()} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add fund definition
        </Button>
      </div>
    </div>
  );
}

function DefinitionEditRow({
  row,
  disabled,
  onCancel,
  onSave,
}: {
  row: Definition;
  disabled: boolean;
  onCancel: () => void;
  onSave: (draft: { label: string; grant_year: number | null; valid_from: string; valid_to_input: string }) => void;
}) {
  const [label, setLabel] = useState(row.label);
  const [grantYear, setGrantYear] = useState(row.grant_year != null ? String(row.grant_year) : '');
  const [validFrom, setValidFrom] = useState(row.valid_from);
  const [validTo, setValidTo] = useState(row.valid_to ?? '');

  return (
    <tr className="bg-muted/30">
      <td className="px-3 py-2">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} disabled={disabled} />
      </td>
      <td className="px-3 py-2">
        <Input value={grantYear} onChange={(e) => setGrantYear(e.target.value)} disabled={disabled} placeholder="Year" />
      </td>
      <td className="px-3 py-2">
        <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} disabled={disabled} />
      </td>
      <td className="px-3 py-2">
        <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} disabled={disabled} />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={disabled}
            onClick={() => {
              const gy = grantYear.trim() === '' ? null : Number(grantYear);
              onSave({
                label: label.trim(),
                grant_year: grantYear.trim() === '' || !Number.isFinite(gy) ? null : gy,
                valid_from: validFrom,
                valid_to_input: validTo,
              });
            }}
          >
            Save
          </Button>
        </div>
      </td>
    </tr>
  );
}
