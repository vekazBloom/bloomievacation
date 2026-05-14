'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

type ProjectOption = { id: string; name: string };

type PlatformInviteFormProps = {
  projects: ProjectOption[];
};

export function PlatformInviteForm({ projects }: PlatformInviteFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [grantSystemAdmin, setGrantSystemAdmin] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [role, setRole] = useState<'employee' | 'lead' | 'admin'>('employee');
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    const body: Record<string, unknown> = {
      email: email.trim().toLowerCase(),
      grantSystemAdmin,
      role,
    };
    if (projectId) {
      body.projectId = projectId;
    }

    const response = await fetch('/api/admin/platform-invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to send invitation');
      return;
    }

    toast.success(`Invitation sent to ${email.trim().toLowerCase()}`);
    setEmail('');
    setGrantSystemAdmin(false);
    setProjectId('');
    setRole('employee');
    router.refresh();
  }

  return (
    <Card className="border-dashed border-primary/25">
      <CardContent className="space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="font-display text-lg">Invite to platform</h2>
          <p className="text-sm text-muted-foreground">
            Send someone access to BloomieVacation without tying them to a project. You can optionally
            add them to a project and set their team role, or grant system administrator access.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform-invite-email">Email</Label>
            <Input
              id="platform-invite-email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <input
              id="platform-invite-sysadmin"
              type="checkbox"
              checked={grantSystemAdmin}
              onChange={(e) => setGrantSystemAdmin(e.target.checked)}
              disabled={isLoading}
              className="mt-1 h-4 w-4 rounded border-input"
            />
            <div className="space-y-0.5">
              <Label htmlFor="platform-invite-sysadmin" className="cursor-pointer font-medium leading-snug">
                System administrator
              </Label>
              <p className="text-xs text-muted-foreground">
                Full access to holidays, all projects, and this invite tool. Leave off for a normal
                member until they join a team.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="platform-invite-project">Project (optional)</Label>
              <select
                id="platform-invite-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">None — platform access only</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform-invite-role">Team role (if project selected)</Label>
              <select
                id="platform-invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'employee' | 'lead' | 'admin')}
                disabled={isLoading || !projectId}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="employee">Employee</option>
                <option value="lead">Lead</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Send platform invite
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
