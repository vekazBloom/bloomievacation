'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type OrphanUser = {
  id: string;
  name: string;
  email: string;
  balances: {
    annualTotal: number;
    annualUsed: number;
    sickTotal: number;
    sickUsed: number;
    religiousTotal: number;
    religiousUsed: number;
  } | null;
  upcomingRequestCount: number;
};

export function UsersWithoutProjectsPanel({
  projectSlug,
  users,
}: {
  projectSlug: string;
  users: OrphanUser[];
}) {
  const router = useRouter();
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [roles, setRoles] = useState<Record<string, 'employee' | 'lead' | 'admin'>>({});

  async function assignUser(userId: string) {
    const role = roles[userId] || 'employee';
    setAssigningUserId(userId);
    const response = await fetch(`/api/projects/${encodeURIComponent(projectSlug)}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    const payload = await response.json().catch(() => ({}));
    setAssigningUserId(null);

    if (!response.ok) {
      toast.error(payload.error || 'Failed to assign user');
      return;
    }

    toast.success('User assigned to project');
    router.refresh();
  }

  return (
    <Card>
      <div className="border-b border-border px-6 py-4">
        <h2 className="font-display text-lg">Users without projects</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Removed users keep planned leave history and global balances. Re-assign them here.
        </p>
      </div>
      <CardContent className="divide-y divide-border p-0">
        {users.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">No users without projects.</p>
        ) : (
          users.map((user) => {
            const isAssigning = assigningUserId === user.id;
            const selectedRole = roles[user.id] || 'employee';

            return (
              <div key={user.id} className="flex flex-wrap items-end justify-between gap-4 px-6 py-4">
                <div className="space-y-2">
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="pending">Global balance sync</Badge>
                    {user.balances ? (
                      <Badge variant="outline">
                        Annual {user.balances.annualUsed}/{user.balances.annualTotal}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Balance migration pending</Badge>
                    )}
                    {user.upcomingRequestCount > 0 ? (
                      <Badge variant="warning">{user.upcomingRequestCount} active request(s)</Badge>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedRole}
                    onChange={(event) =>
                      setRoles((current) => ({
                        ...current,
                        [user.id]: event.target.value as 'employee' | 'lead' | 'admin',
                      }))
                    }
                    className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                    disabled={isAssigning}
                  >
                    <option value="employee">Employee</option>
                    <option value="lead">Lead</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => assignUser(user.id)}
                    disabled={isAssigning}
                  >
                    {isAssigning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    Assign to this project
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

