'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MailPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

type InviteMemberFormProps = {
  projectId: string;
};

export function InviteMemberForm({ projectId }: InviteMemberFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'employee' | 'lead' | 'admin'>('employee');
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, email, role }),
    });

    const payload = await response.json().catch(() => ({}));
    setIsLoading(false);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to send invitation');
      return;
    }

    toast.success(`Invitation sent to ${email.trim().toLowerCase()}`);
    setEmail('');
    setRole('employee');
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="space-y-1">
          <h2 className="font-display text-lg">Invite a teammate</h2>
          <p className="text-sm text-muted-foreground">
            We will email them a branded invitation with a secure link to join this project.
          </p>
        </div>

        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              autoComplete="email"
              placeholder="teammate@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value as 'employee' | 'lead' | 'admin')}
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="employee">Employee</option>
              <option value="lead">Lead</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
            Send invite
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
