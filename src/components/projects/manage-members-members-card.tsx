'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { MemberManagerRow, type AnnualFundDefinitionOption } from '@/components/projects/member-manager-row';

export type ManageMembersMemberRow = {
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

export function ManageMembersMembersCard({
  projectSlug,
  members,
  fundDefinitions,
  assignmentsByUserId,
  otherProjectsByUser,
}: {
  projectSlug: string;
  members: ManageMembersMemberRow[];
  fundDefinitions: AnnualFundDefinitionOption[];
  assignmentsByUserId: Record<string, string[]>;
  otherProjectsByUser: Map<string, { slug: string; name: string }[]>;
}) {
  const [filter, setFilter] = useState<'all' | 'none' | string>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return members;
    return members.filter((m) => {
      const uid = m.users?.id;
      if (!uid) return false;
      const assigned = assignmentsByUserId[uid] ?? [];
      if (filter === 'none') return assigned.length === 0;
      return assigned.includes(filter);
    });
  }, [members, assignmentsByUserId, filter]);

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-4 border-b border-border px-6 py-4">
        <h2 className="font-display min-w-0 flex-1 text-lg">Current members</h2>
        <div className="space-y-1">
          <label htmlFor="member-fund-filter" className="text-xs text-muted-foreground">
            Filter by fund template
          </label>
          <select
            id="member-fund-filter"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="flex h-9 min-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="all">All members</option>
            <option value="none">Not linked to any template</option>
            {fundDefinitions.map((d) => (
              <option key={d.id} value={d.id}>
                Has: {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">No members match this filter.</p>
        ) : (
          filtered.map((member) => (
            <MemberManagerRow
              key={member.id}
              projectSlug={projectSlug}
              member={member}
              otherProjects={otherProjectsByUser.get(member.users?.id) || []}
              fundDefinitions={fundDefinitions}
              assignedDefinitionIds={assignmentsByUserId[member.users.id] ?? []}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
