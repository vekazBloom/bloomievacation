import Link from 'next/link';
import { Suspense } from 'react';
import { ArrowRight, Plane, Stethoscope, Sparkles, FolderKanban } from 'lucide-react';
import { DashboardAdminOverviewFallback } from '@/components/dashboard/dashboard-admin-overview-fallback';
import { DashboardAdminOverviewSection } from '@/components/dashboard/dashboard-admin-overview-section';
import { DashboardSentInvitationsSection } from '@/components/dashboard/dashboard-sent-invitations-section';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getUserLeaveBalance } from '@/lib/leave/global-balance';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';
import { formatDateRange } from '@/lib/utils';
import { projectPath } from '@/lib/projects/paths';

export default async function DashboardPage() {
  const session = await getDashboardSession();
  if (!session) return null;

  const { supabase, user, profile } = session;

  // Aggregate balance across all my projects.
  const { data: memberships } = await supabase
    .from('project_members')
    .select(
      `
      annual_leave_total, annual_leave_used, annual_leave_carried_over,
      sick_leave_total, sick_leave_used,
      religious_leave_total, religious_leave_used,
      role,
      projects(id, name, logo_url, is_archived, slug)
    `
    )
    .eq('user_id', user.id);

  const activeMemberships = (memberships || []).filter((m: any) => m.projects && !m.projects.is_archived);

  const { data: globalBalance } = await getUserLeaveBalance(supabase, user.id);

  // Prefer globally synchronized user balances; fallback to project-sum if migration isn't applied.
  const totals = globalBalance
    ? {
        annualTotal:
          Number(globalBalance.annual_leave_total || 0) +
          Number(globalBalance.annual_leave_carried_over || 0),
        annualUsed: Number(globalBalance.annual_leave_used || 0),
        sickTotal: Number(globalBalance.sick_leave_total || 0),
        sickUsed: Number(globalBalance.sick_leave_used || 0),
        religiousTotal: Number(globalBalance.religious_leave_total || 0),
        religiousUsed: Number(globalBalance.religious_leave_used || 0),
      }
    : activeMemberships.reduce(
        (acc: any, m: any) => ({
          annualTotal:
            acc.annualTotal + (m.annual_leave_total || 0) + Number(m.annual_leave_carried_over || 0),
          annualUsed: acc.annualUsed + Number(m.annual_leave_used || 0),
          sickTotal: acc.sickTotal + (m.sick_leave_total || 0),
          sickUsed: acc.sickUsed + Number(m.sick_leave_used || 0),
          religiousTotal: acc.religiousTotal + (m.religious_leave_total || 0),
          religiousUsed: acc.religiousUsed + Number(m.religious_leave_used || 0),
        }),
        {
          annualTotal: 0,
          annualUsed: 0,
          sickTotal: 0,
          sickUsed: 0,
          religiousTotal: 0,
          religiousUsed: 0,
        }
      );

  // Upcoming requests.
  const today = new Date().toISOString().split('T')[0];
  const { data: upcoming } = await supabase
    .from('leave_requests')
    .select('id, type, status, start_date, end_date, project_id, projects(name, slug)')
    .eq('user_id', user.id)
    .gte('end_date', today)
    .in('status', ['pending', 'approved'])
    .order('start_date', { ascending: true })
    .limit(5);

  // Pending approvals (if I'm a lead/admin somewhere).
  const leadProjectIds = activeMemberships
    .filter((m: any) => m.role === 'admin' || m.role === 'lead')
    .map((m: any) => m.projects.id);

  const { data: pendingApprovals } =
    leadProjectIds.length > 0
      ? await supabase
          .from('leave_requests')
          .select(`id, type, start_date, end_date, working_days_count, user_id, project_id, ${leaveRequestUserEmbed}(name, avatar_url), projects(name, slug)`)
          .in('project_id', leadProjectIds)
          .eq('status', 'pending')
          .neq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
      : { data: [] };

  const weekEnd = new Date();
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndIso = weekEnd.toISOString().split('T')[0];

  const { data: awayThisWeek } =
    activeMemberships.length > 0
      ? await supabase
          .from('leave_requests')
          .select(`id, type, start_date, end_date, ${leaveRequestUserEmbed}(name), projects(name, slug), project_id`)
          .in(
            'project_id',
            activeMemberships.map((m: any) => m.projects.id)
          )
          .eq('status', 'approved')
          .lte('start_date', weekEndIso)
          .gte('end_date', today)
          .order('start_date', { ascending: true })
          .limit(8)
      : { data: [] };

  return (
    <div className="mx-auto max-w-6xl space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {profile?.is_system_admin
            ? 'System-wide overview and your personal leave snapshot.'
            : `Your time off at a glance, across ${activeMemberships.length} ${
                activeMemberships.length === 1 ? 'project' : 'projects'
              }.`}
        </p>
      </div>

      {profile?.is_system_admin ? (
        <Suspense fallback={<DashboardAdminOverviewFallback />}>
          <DashboardAdminOverviewSection />
        </Suspense>
      ) : null}

      <DashboardSentInvitationsSection supabase={supabase} userId={user.id} />

      {/* Balance cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BalanceCard
          icon={Plane}
          label="Annual leave"
          used={totals.annualUsed}
          total={totals.annualTotal}
          color="primary"
          accent="bg-primary/10 text-primary"
        />
        <BalanceCard
          icon={Stethoscope}
          label="Sick leave"
          used={totals.sickUsed}
          total={totals.sickTotal}
          color="emerald"
          accent="bg-emerald-100 text-emerald-700"
        />
        <BalanceCard
          icon={Sparkles}
          label="Religious holidays"
          used={totals.religiousUsed}
          total={totals.religiousTotal}
          color="amber"
          accent="bg-amber-100 text-amber-800"
        />
      </div>

      {/* Empty state for new users */}
      {activeMemberships.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-lg">No projects yet</p>
              <p className="max-w-md text-sm text-muted-foreground">
                You&apos;ll see your team&apos;s calendar and submit leave requests here once
                you join a project. Ask your admin for an invite.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg">Away this week</h2>
        </div>
        <div className="divide-y divide-border">
          {(awayThisWeek || []).length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No approved leave in your projects this week.
            </p>
          ) : (
            (awayThisWeek || []).map((req: any) => (
              <Link
                key={req.id}
                href={
                  req.projects?.slug ? projectPath(req.projects.slug, 'requests') : '#'
                }
                className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-accent/30"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{req.users?.name || 'Teammate'}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {req.projects?.name} · {formatDateRange(req.start_date, req.end_date)}
                  </p>
                </div>
                <Badge variant="outline" className="uppercase">{req.type}</Badge>
              </Link>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming */}
        <Card>
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="font-display text-lg">Your upcoming time off</h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/calendar">
                View all <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </div>
          <div className="divide-y divide-border">
            {(upcoming || []).length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                Nothing on the horizon. Time to plan a break? 🌴
              </p>
            ) : (
              (upcoming || []).map((req: any) => (
                <Link
                  key={req.id}
                  href={
                    req.projects?.slug ? projectPath(req.projects.slug, 'requests') : '#'
                  }
                  className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-accent/30"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <LeaveTypeIcon type={req.type} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {formatDateRange(req.start_date, req.end_date)}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {req.projects?.name || 'Project'}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={req.status} />
                </Link>
              ))
            )}
          </div>
        </Card>

        {/* Pending approvals (only for leads/admins) */}
        {leadProjectIds.length > 0 && (
          <Card>
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="font-display text-lg">Awaiting your approval</h2>
              {(pendingApprovals?.length ?? 0) > 0 && (
                <Badge variant="pending">{pendingApprovals?.length} pending</Badge>
              )}
            </div>
            <div className="divide-y divide-border">
              {(pendingApprovals?.length ?? 0) === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  All caught up. ✨
                </p>
              ) : (
                (pendingApprovals || []).map((req: any) => (
                  <Link
                    key={req.id}
                    href={
                      req.projects?.slug ? projectPath(req.projects.slug, 'requests') : '#'
                    }
                    className="flex items-center justify-between gap-3 px-6 py-3 transition-colors hover:bg-accent/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <LeaveTypeIcon type={req.type} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {req.users?.name || 'Someone'} · {req.working_days_count}d
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {formatDateRange(req.start_date, req.end_date)}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </Link>
                ))
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function BalanceCard({
  icon: Icon,
  label,
  used,
  total,
  accent,
}: {
  icon: any;
  label: string;
  used: number;
  total: number;
  color: string;
  accent: string;
}) {
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const display = total > 0 ? `${used} / ${total}` : `${used}`;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
          <span className="font-mono text-2xl font-medium tabular-nums">{display}</span>
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {total > 0 ? `${remaining} days remaining` : 'No limit set'}
          </p>
        </div>
        {total > 0 && (
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeaveTypeIcon({ type }: { type: string }) {
  const map: Record<string, { icon: any; bg: string; fg: string }> = {
    annual: { icon: Plane, bg: 'bg-primary/10', fg: 'text-primary' },
    sick: { icon: Stethoscope, bg: 'bg-emerald-100', fg: 'text-emerald-700' },
    religious: { icon: Sparkles, bg: 'bg-amber-100', fg: 'text-amber-700' },
  };
  const { icon: Icon, bg, fg } = map[type] || map.annual;
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${bg} ${fg}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'approved') return <Badge variant="success">Approved</Badge>;
  if (status === 'pending') return <Badge variant="pending">Pending</Badge>;
  if (status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
