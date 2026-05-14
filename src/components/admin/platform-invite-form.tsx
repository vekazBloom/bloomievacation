'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ProjectOption = { id: string; name: string };

type PlatformInviteFormProps = {
  projects: ProjectOption[];
};

const selectClassName = cn(
  'flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm',
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
);

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
    <Card className="border border-border shadow-sm">
      <CardContent className="min-w-0 space-y-6 p-6 sm:p-8">
        <header className="space-y-2">
          <h2 className="font-display text-xl font-medium tracking-tight sm:text-2xl">Invite to platform</h2>
          <p className="max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">
            Send someone access to BloomieVacation without tying them to a project. Optionally add them
            to a team and set a role, or grant system administrator access.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-6">
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
              className="h-11"
            />
          </div>

          <div className="flex gap-3 rounded-xl border border-border bg-muted/20 px-4 py-4 sm:px-5 sm:py-4">
            <input
              id="platform-invite-sysadmin"
              type="checkbox"
              checked={grantSystemAdmin}
              onChange={(e) => setGrantSystemAdmin(e.target.checked)}
              disabled={isLoading}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
            />
            <div className="min-w-0 space-y-1">
              <Label htmlFor="platform-invite-sysadmin" className="cursor-pointer text-base font-medium leading-snug">
                System administrator
              </Label>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                Full access to holidays, all projects, and this invite tool. Leave off for a normal member
                until they join a team.
              </p>
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
            <div className="min-w-0 space-y-2">
              <div className="space-y-1">
                <Label htmlFor="platform-invite-project">Project (optional)</Label>
                <p className="text-xs text-muted-foreground">Skip if they only need an account for now.</p>
              </div>
              <select
                id="platform-invite-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={isLoading}
                className={selectClassName}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0 space-y-2">
              <div className="space-y-1">
                <Label htmlFor="platform-invite-role" className={!projectId ? 'text-muted-foreground' : undefined}>
                  Team role
                </Label>
                <p className="text-xs text-muted-foreground">
                  {projectId ? 'Role in the project you selected above.' : 'Select a project to enable this.'}
                </p>
              </div>
              <select
                id="platform-invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'employee' | 'lead' | 'admin')}
                disabled={isLoading || !projectId}
                className={cn(selectClassName, !projectId && 'opacity-60')}
              >
                <option value="employee">Employee</option>
                <option value="lead">Lead</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground sm:max-w-md">
              They will receive an email with a secure link. Invites expire after seven days.
            </p>
            <Button type="submit" disabled={isLoading} size="lg" className="w-full shrink-0 sm:w-auto sm:min-w-[200px]">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Send platform invite
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
