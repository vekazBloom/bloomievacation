'use client';

import Link from 'next/link';
import { useState } from 'react';
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

export function MemberManagerRow({
  projectSlug,
  member,
  otherProjects = [],
}: {
  projectSlug: string;
  member: MemberRow;
  otherProjects?: Array<{ slug: string; name: string }>;
}) {
  const router = useRouter();
  const [role, setRole] = useState(member.role);
  const [annualTotal, setAnnualTotal] = useState(String(member.annual_leave_total));
  const [sickTotal, setSickTotal] = useState(String(member.sick_leave_total));
  const [religiousTotal, setReligiousTotal] = useState(String(member.religious_leave_total));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function saveChanges() {
    setIsSaving(true);
    const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/members/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role,
        annual_leave_total: Number(annualTotal),
        sick_leave_total: Number(sickTotal),
        religious_leave_total: Number(religiousTotal),
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setIsSaving(false);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to update member');
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
    <div className="grid gap-4 border-b border-border px-6 py-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,0.6fr))_auto] lg:items-end">
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
        <label className="text-xs text-muted-foreground">Annual total</label>
        <Input value={annualTotal} onChange={(event) => setAnnualTotal(event.target.value)} />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Sick total</label>
        <Input value={sickTotal} onChange={(event) => setSickTotal(event.target.value)} />
      </div>

      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Religious total</label>
        <Input value={religiousTotal} onChange={(event) => setReligiousTotal(event.target.value)} />
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
