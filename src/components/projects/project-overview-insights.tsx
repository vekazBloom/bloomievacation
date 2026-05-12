import Link from 'next/link';
import { ArrowRight, CalendarDays, ClipboardList, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { ProjectOverviewStats } from '@/lib/projects/overview';
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

export function ProjectOverviewInsights({
  projectSlug,
  stats,
}: {
  projectSlug: string;
  stats: ProjectOverviewStats;
}) {
  const requestTotal = Math.max(
    1,
    stats.leaveTypeCounts.annual + stats.leaveTypeCounts.sick + stats.leaveTypeCounts.religious
  );

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
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-display text-lg">Team leave utilization</h2>
            <p className="text-sm text-muted-foreground">Used leave across the whole project.</p>
          </div>
          <CardContent className="space-y-5 p-6">
            <UtilizationBar
              label="Annual leave"
              used={stats.utilization.annualUsed}
              total={stats.utilization.annualTotal}
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
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-display text-lg">Request mix</h2>
            <p className="text-sm text-muted-foreground">Leave types and request statuses in this project.</p>
          </div>
          <CardContent className="space-y-6 p-6">
            <div className="space-y-4">
              <DistributionBar
                label="Annual"
                value={stats.leaveTypeCounts.annual}
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
                <p className="mt-1 font-mono text-2xl tabular-nums">{stats.statusCounts.pending}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Approved</p>
                <p className="mt-1 font-mono text-2xl tabular-nums">{stats.statusCounts.approved}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Rejected</p>
                <p className="mt-1 font-mono text-2xl tabular-nums">{stats.statusCounts.rejected}</p>
              </div>
              <div className="rounded-lg border border-border px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Cancelled</p>
                <p className="mt-1 font-mono text-2xl tabular-nums">{stats.statusCounts.cancelled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="border-b border-border px-6 py-4">
            <h2 className="font-display text-lg">Highest annual usage</h2>
            <p className="text-sm text-muted-foreground">Members closest to using their annual allowance.</p>
          </div>
          <CardContent className="space-y-4 p-6">
            {stats.memberUtilization.length === 0 ? (
              <p className="text-sm text-muted-foreground">No member balances yet.</p>
            ) : (
              stats.memberUtilization.map((member) => (
                <div key={member.name} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{member.name}</span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {member.annualPct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${member.annualPct}%` }} />
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
