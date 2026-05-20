'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ALL_ANNUAL_FUNDS,
  AnnualFundFilterSelect,
} from '@/components/projects/annual-fund-filter-select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type {
  AnnualFundDefinitionOption,
  MemberFundBalanceRow,
} from '@/lib/projects/overview-fund-stats';
import { projectPath } from '@/lib/projects/paths';
import { getInitials } from '@/lib/utils';

export type ProjectTeamMemberRow = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  annualUsed: number;
  annualTotal: number;
  sickUsed: number;
  sickTotal: number;
  religiousUsed: number;
  religiousTotal: number;
};

export function ProjectTeamMembersTable({
  projectSlug,
  isAdmin,
  members,
  fundDefinitions,
  fundBalancesByDefinition,
}: {
  projectSlug: string;
  isAdmin: boolean;
  members: ProjectTeamMemberRow[];
  fundDefinitions: AnnualFundDefinitionOption[];
  fundBalancesByDefinition: Record<string, Record<string, MemberFundBalanceRow>>;
}) {
  const [fundFilter, setFundFilter] = useState<string>(ALL_ANNUAL_FUNDS);

  const selectedFundLabel = useMemo(() => {
    if (fundFilter === ALL_ANNUAL_FUNDS) return null;
    return fundDefinitions.find((definition) => definition.id === fundFilter)?.label ?? null;
  }, [fundDefinitions, fundFilter]);

  const annualColumnLabel =
    fundFilter === ALL_ANNUAL_FUNDS ? 'Annual' : selectedFundLabel ? `Annual (${selectedFundLabel})` : 'Annual';

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-lg">Team members</h2>
          <p className="text-sm text-muted-foreground">
            Leave balances per person. {isAdmin && '(Click a row to edit)'}
            {fundFilter !== ALL_ANNUAL_FUNDS ? (
              <>
                {' '}
                Annual column shows the selected fund; sick and religious use the team allowance.
              </>
            ) : null}
          </p>
        </div>
        <AnnualFundFilterSelect
          id="team-members-fund-filter"
          value={fundFilter}
          definitions={fundDefinitions}
          onChange={setFundFilter}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-6 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">{annualColumnLabel}</th>
              <th className="px-4 py-3 text-left font-medium">Sick</th>
              <th className="px-4 py-3 text-left font-medium">Religious</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {members.map((member) => {
              const fundBalance =
                fundFilter === ALL_ANNUAL_FUNDS
                  ? null
                  : fundBalancesByDefinition[fundFilter]?.[member.userId];
              const annualUsed =
                fundFilter === ALL_ANNUAL_FUNDS ? member.annualUsed : fundBalance?.used ?? 0;
              const annualTotal =
                fundFilter === ALL_ANNUAL_FUNDS ? member.annualTotal : fundBalance?.total ?? 0;

              return (
                <tr key={member.userId} className="hover:bg-accent/30">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-7 w-7">
                        {member.avatarUrl ? (
                          <AvatarImage src={member.avatarUrl} alt={member.name} />
                        ) : null}
                        <AvatarFallback className="text-[10px]">{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link
                          href={projectPath(projectSlug, 'members', member.userId)}
                          className="truncate font-medium hover:underline"
                        >
                          {member.name}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="font-mono uppercase">
                      {member.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {annualUsed} / {annualTotal}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {member.sickUsed} / {member.sickTotal}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums">
                    {member.religiousUsed} / {member.religiousTotal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
