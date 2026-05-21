'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, ClipboardList, Users } from 'lucide-react';
import { AnnualFundFilterSelect } from '@/components/projects/annual-fund-filter-select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { ProjectOverviewStats } from '@/lib/projects/overview';
import type {
  AnnualFundDefinitionOption,
  FundScopedOverviewSlice,
} from '@/lib/projects/overview-fund-stats';
import { formatDateRange } from '@/lib/utils';
import { projectPath } from '@/lib/projects/paths';

function UtilizationBar({
  label,
  used,
  total,
  accentClass,
}: {
  label: string;
  used: number;
  total: number;
  accentClass: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {used} / {total}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DistributionBar({
  label,
  value,
  max,
  accentClass,
}: {
  label: string;
  value: number;
  max: number;
  accentClass: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${accentClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function InsightsCardHeader({
  title,
  description,
  filterId,
  fundFilter,
  fundDefinitions,
  onFundFilterChange,
}: {
  title: string;
  description: string;
  filterId: string;
  fundFilter: string;
  fundDefinitions: AnnualFundDefinitionOption[];
  onFundFilterChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-display text-lg">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <AnnualFundFilterSelect
        id={filterId}
        value={fundFilter}
        definitions={fundDefinitions}
        onChange={onFundFilterChange}
      />
    </div>
  );
}

export function ProjectOverviewInsights({
  projectSlug,
  stats,
  fundDefinitions,
  fundStats,
  defaultFundId,
}: {
  projectSlug: string;
  stats: ProjectOverviewStats;
  fundDefinitions: AnnualFundDefinitionOption[];
  fundStats: Record<string, FundScopedOverviewSlice>;
  defaultFundId: string;
}) {
  const [utilizationFund, setUtilizationFund] = useState(defaultFundId);
  const [requestMixFund, setRequestMixFund] = useState(defaultFundId);
  const [memberUsageFund, setMemberUsageFund] = useState(defaultFundId);

  const utilizationSlice = useMemo(
    () =>
      fundStats[utilizationFund]?.utilization ?? {
        annualUsed: 0,
        annualTotal: 0,
      },
    [fundStats, utilizationFund]
  );

  const requestMixSlice = useMemo(() => {
    const scoped = fundStats[requestMixFund];
    return {
      annual: scoped?.leaveTypeCounts.annual ?? 0,
      statusCounts: scoped?.statusCounts ?? {
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
      },
    };
  }, [fundStats, requestMixFund]);

  const memberUtilization = useMemo(
    () => fundStats[memberUsageFund]?.memberUtilization ?? [],
    [fundStats, memberUsageFund]
  );

  const requestTotal = Math.max(
    1,
    requestMixSlice.annual + stats.leaveTypeCounts.sick + stats.leaveTypeCounts.religious
  );

  const selectedUtilizationFundLabel = fundDefinitions.find(
    (definition) => definition.id === utilizationFund
  )?.label;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Team members</p>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-mono text-3xl tabular-nums">{stats.memberCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Pending requests</p>
              <ClipboardList className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-mono text-3xl tabular-nums">{stats.pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Approved this month</p>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-mono text-3xl tabular-nums">{stats.approvedThisMonth}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Away this week</p>
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-mono text-3xl tabular-nums">{stats.awayThisWeek}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <InsightsCardHeader
            title="Team leave utilization"
            description="Used leave across the whole project."
            filterId="overview-utilization-fund"
            fundFilter={utilizationFund}
            fundDefinitions={fundDefinitions}
            onFundFilterChange={setUtilizationFund}
          />
          <CardContent className="space-y-5 p-6">
            <UtilizationBar
              label={
                selectedUtilizationFundLabel
                  ? `Annual leave (${selectedUtilizationFundLabel})`
                  : 'Annual leave (fund)'
              }
              used={utilizationSlice.annualUsed}
              total={utilizationSlice.annualTotal}
              accentClass="bg-primary"
            />
            <UtilizationBar
              label="Sick leave"
              used={stats.utilization.sickUsed}
              total={stats.utilization.sickTotal}
              accentClass="bg-emerald-500"
            />
            <UtilizationBar
              label="Religious leave"
              used={stats.utilization.religiousUsed}
              total={stats.utilization.religiousTotal}
              accentClass="bg-amber-500"
            />
          </CardContent>
        </Card>

        <Card>
          <InsightsCardHeader
            title="Request mix"
            description="Leave types and request statuses in this project."
            filterId="overview-request-mix-fund"
            fundFilter={requestMixFund}
            fundDefinitions={fundDefinitions}
            onFundFilterChange={setRequestMixFund}
          />
          <CardContent className="space-y-6 p-6">
            <div className="space-y-4">
              <DistributionBar
                label="Annual"
                value={requestMixSlice.annual}
                max={requestTotal}
                accentClass="bg-sky-500"
              />
              <DistributionBar
                label="Sick"
                value={stats.leaveTypeCounts.sick}
                max={requestTotal}
                accentClass="bg-emerald-500"
              />
              <DistributionBar
                label="Religious"
                value={stats.leaveTypeCounts.religious}
                max={requestTotal}
                accentClass="bg-amber-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
                <p className="mt-1 font-mono text-2xl tabular-nums">
                  {requestMixSlice.statusCounts.pending}
                </p>
              </div>
              <div className="rounded-lg border border-border px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved</p>
                <p className="mt-1 font-mono text-2xl tabular-nums">
                  {requestMixSlice.statusCounts.approved}
                </p>
              </div>
              <div className="rounded-lg border border-border px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rejected</p>
                <p className="mt-1 font-mono text-2xl tabular-nums">
                  {requestMixSlice.statusCounts.rejected}
                </p>
              </div>
              <div className="rounded-lg border border-border px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cancelled</p>
                <p className="mt-1 font-mono text-2xl tabular-nums">
                  {requestMixSlice.statusCounts.cancelled}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <InsightsCardHeader
            title="Highest annual usage"
            description="Members closest to using their annual allowance."
            filterId="overview-member-usage-fund"
            fundFilter={memberUsageFund}
            fundDefinitions={fundDefinitions}
            onFundFilterChange={setMemberUsageFund}
          />
          <CardContent className="space-y-4 p-6">
            {memberUtilization.length === 0 ? (
              <p className="text-sm text-muted-foreground">No member balances for this fund yet.</p>
            ) : (
              memberUtilization.map((member) => (
                <div key={member.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{member.name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {member.annualPct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${member.annualPct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <h2 className="font-display text-lg">Upcoming leave</h2>
              <p className="text-sm text-muted-foreground">Next approved and pending absences.</p>
            </div>
            <Link href={projectPath(projectSlug, 'calendar')} className="text-sm text-primary hover:underline">
              Open calendar
            </Link>
          </div>
          <CardContent className="divide-y divide-border p-0">
            {stats.upcomingLeave.length === 0 ? (
              <p className="px-6 py-8 text-sm text-muted-foreground">No upcoming leave scheduled.</p>
            ) : (
              stats.upcomingLeave.map((request) => (
                <Link
                  key={request.id}
                  href={projectPath(projectSlug, 'requests')}
                  className="flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-accent/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{request.userName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateRange(request.startDate, request.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="uppercase">
                      {request.type}
                    </Badge>
                    <Badge variant={request.status === 'approved' ? 'success' : 'pending'} className="uppercase">
                      {request.status}
                    </Badge>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
