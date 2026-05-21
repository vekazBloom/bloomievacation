'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRoleLabel } from '@/lib/email/format';
import { projectPath } from '@/lib/projects/paths';

type MemberRow = {
  id: string;
  role: 'admin' | 'lead' | 'employee';
  annual_leave_total: number;
  sick_leave_total: number;
  religious_leave_total: number;
  users: {
    id: string;
    name: string;
    email: string;
  };
};

export type AnnualFundDefinitionOption = { id: string; label: string };

export function MemberManagerRow({
  projectSlug,
  member,
  otherProjects = [],
  fundDefinitions = [],
  assignedDefinitionIds = [],
  canEditLeaveBalances = false,
}: {
  projectSlug: string;
  member: MemberRow;
  otherProjects?: Array<{ slug: string; name: string }>;
  fundDefinitions?: AnnualFundDefinitionOption[];
  /** Global fund templates this user is assigned to (all projects). */
  assignedDefinitionIds?: string[];
  canEditLeaveBalances?: boolean;
}) {
  const router = useRouter();
  const [role, setRole] = useState(member.role);
  const [annualTotal, setAnnualTotal] = useState(String(member.annual_leave_total));
  const [sickTotal, setSickTotal] = useState(String(member.sick_leave_total));
  const [religiousTotal, setReligiousTotal] = useState(String(member.religious_leave_total));
  const [selectedDefIds, setSelectedDefIds] = useState<Set<string>>(() => new Set(assignedDefinitionIds));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setSelectedDefIds(new Set(assignedDefinitionIds));
  }, [member.id, assignedDefinitionIds.join('|')]);

  function toggleDefinition(id: string) {
    setSelectedDefIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveChanges() {
    setIsSaving(true);
    const body: Record<string, unknown> = {
      role,
      annual_fund_definition_ids: Array.from(selectedDefIds),
    };
    if (canEditLeaveBalances) {
      body.annual_leave_total = Number(annualTotal);
      body.sick_leave_total = Number(sickTotal);
      body.religious_leave_total = Number(religiousTotal);
    }

    const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => ({}));
    setIsSaving(false);

    if (!response.ok) {
      toast.error((result as { error?: string }).error || 'Failed to update member');
      return;
    }

    toast.success(`Updated ${member.users.name}`);
    router.refresh();
  }

  async function removeMember() {
    if (!window.confirm(`Remove ${member.users.name} from this project?`)) return;

    setIsDeleting(true);
    const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/members/${member.id}`, {
      method: 'DELETE',
    });
    const payload = await response.json().catch(() => ({}));
    setIsDeleting(false);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to remove member');
      return;
    }

    toast.success(`Removed ${member.users.name}`);
    router.refresh();
  }

  return (
    <div className="grid gap-4 border-b border-border px-6 py-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.5fr)_minmax(0,0.95fr)_repeat(3,minmax(0,0.52fr))_auto] lg:items-end">
      <div>
        <Link
          href={projectPath(projectSlug, 'members', member.users.id)}
          className="font-medium hover:underline"
        >
          {member.users.name}
        </Link>
        <p className="text-sm text-muted-foreground">{member.users.email}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="pending">Global balance sync</Badge>
          {otherProjects.length > 0 ? (
            <>
              <Badge variant="outline">Also in {otherProjects.length} project(s)</Badge>
              {otherProjects.slice(0, 2).map((project) => (
                <Link
                  key={project.slug}
                  href={projectPath(project.slug)}
                  className="inline-flex"
                  title={project.name}
                >
                  <Badge variant="secondary" className="max-w-[180px] truncate">
                    {project.name}
                  </Badge>
                </Link>
              ))}
              {otherProjects.length > 2 ? (
                <Badge variant="outline">+{otherProjects.length - 2} more</Badge>
              ) : null}
            </>
          ) : (
            <Badge variant="outline">Only this project</Badge>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Role</label>
        <select
          value={role}
          onChange={(event) => setRole(event.target.value as MemberRow['role'])}
          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="employee">Employee</option>
          <option value="lead">Lead</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Assign to fund templates (global)</label>
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-input bg-background px-2 py-2">
          {fundDefinitions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No templates defined yet.</p>
          ) : (
            fundDefinitions.map((def) => (
              <label key={def.id} className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
                  checked={selectedDefIds.has(def.id)}
                  onChange={() => toggleDefinition(def.id)}
                />
                <span>{def.label}</span>
              </label>
            ))
          )}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Checked funds apply on every project this person joins. Set how many days each person gets per fund on
          their member profile.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Annual total</label>
        {canEditLeaveBalances ? (
          <Input value={annualTotal} onChange={(event) => setAnnualTotal(event.target.value)} />
        ) : (
          <p className="flex h-9 items-center font-mono text-sm tabular-nums">{annualTotal}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Sick total</label>
        {canEditLeaveBalances ? (
          <Input value={sickTotal} onChange={(event) => setSickTotal(event.target.value)} />
        ) : (
          <p className="flex h-9 items-center font-mono text-sm tabular-nums">{sickTotal}</p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Religious total</label>
        {canEditLeaveBalances ? (
          <Input value={religiousTotal} onChange={(event) => setReligiousTotal(event.target.value)} />
        ) : (
          <p className="flex h-9 items-center font-mono text-sm tabular-nums">{religiousTotal}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="hidden font-mono uppercase lg:inline-flex">
          {formatRoleLabel(role)}
        </Badge>
        <Button type="button" size="sm" onClick={saveChanges} disabled={isSaving || isDeleting}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={removeMember}
          disabled={isSaving || isDeleting}
          aria-label={`Remove ${member.users.name}`}
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
