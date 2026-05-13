import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TeamSchedulerLazy as TeamScheduler } from '@/components/calendar/team-scheduler-lazy';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { mapLeaveRequestToEvent } from '@/lib/calendar/map-events';
import { leaveRequestUserEmbed } from '@/lib/leave/queries';

export default async function UsersWithoutProjectsPage() {
  const session = await getDashboardSession();
  if (!session) redirect('/login');

  const { supabase, profile } = session;
  if (!profile.is_system_admin) redirect('/dashboard');

  const [{ data: users }, { data: memberships }] = await Promise.all([
    supabase.from('users').select('id, name, email').order('name', { ascending: true }),
    supabase.from('project_members').select('user_id'),
  ]);

  const assignedUserIds = new Set((memberships || []).map((membership) => membership.user_id));
  const orphans = (users || []).filter((user) => !assignedUserIds.has(user.id));
  const orphanUserIds = orphans.map((user) => user.id);
  const today = new Date().toISOString().split('T')[0];

  const { data: activeRequests } =
    orphanUserIds.length > 0
      ? await supabase
          .from('leave_requests')
          .select('id, user_id, status')
          .in('user_id', orphanUserIds)
          .in('status', ['pending', 'approved'])
          .gte('end_date', today)
      : { data: [] };

  const { data: upcomingRequests } =
    orphanUserIds.length > 0
      ? await supabase
          .from('leave_requests')
          .select(
            `id, user_id, type, status, start_date, end_date, projects(name), ${leaveRequestUserEmbed}(name, avatar_url)`
          )
          .in('user_id', orphanUserIds)
          .in('status', ['pending', 'approved'])
          .gte('end_date', today)
          .order('start_date', { ascending: true })
      : { data: [] };

  const activeCountByUser = (activeRequests || []).reduce(
    (acc, request) => {
      acc.set(request.user_id, (acc.get(request.user_id) || 0) + 1);
      return acc;
    },
    new Map<string, number>()
  );

  const pendingCountByUser = (activeRequests || []).reduce(
    (acc, request) => {
      if (request.status === 'pending') {
        acc.set(request.user_id, (acc.get(request.user_id) || 0) + 1);
      }
      return acc;
    },
    new Map<string, number>()
  );

  const approvedCountByUser = (activeRequests || []).reduce(
    (acc, request) => {
      if (request.status === 'approved') {
        acc.set(request.user_id, (acc.get(request.user_id) || 0) + 1);
      }
      return acc;
    },
    new Map<string, number>()
  );

  const { data: balances } =
    orphanUserIds.length > 0
      ? await supabase
          .from('user_leave_balances')
          .select(
            'user_id, annual_leave_total, annual_leave_used, annual_leave_carried_over, sick_leave_total, sick_leave_used, religious_leave_total, religious_leave_used'
          )
          .in('user_id', orphanUserIds)
      : { data: [] };

  const balancesByUser = new Map((balances || []).map((balance) => [balance.user_id, balance]));

  const schedulerMembers = orphans.map((user) => ({ id: user.id, name: user.name }));
  const schedulerEvents = (upcomingRequests || []).map((request) => mapLeaveRequestToEvent(request));

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Users without projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These users are currently not assigned to any project. Their global leave balances remain
          active and can be reused when reassigned.
        </p>
      </div>

      <Card>
        <CardContent className="divide-y divide-border p-0">
          {orphans.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">No users without projects.</p>
          ) : (
            orphans.map((user) => {
              const balance = balancesByUser.get(user.id);
              return (
                <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                  <div className="space-y-2">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="pending">Global balance sync</Badge>
                      {balance ? (
                        <Badge variant="outline">
                          Annual {Number(balance.annual_leave_used || 0)}/
                          {Number(balance.annual_leave_total || 0) +
                            Number(balance.annual_leave_carried_over || 0)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Balance migration pending</Badge>
                      )}
                      {(activeCountByUser.get(user.id) || 0) > 0 ? (
                        <Badge variant="warning">{activeCountByUser.get(user.id)} active request(s)</Badge>
                      ) : null}
                      {(pendingCountByUser.get(user.id) || 0) > 0 ? (
                        <Badge variant="pending">{pendingCountByUser.get(user.id)} pending</Badge>
                      ) : null}
                      {(approvedCountByUser.get(user.id) || 0) > 0 ? (
                        <Badge variant="success">{approvedCountByUser.get(user.id)} approved upcoming</Badge>
                      ) : null}
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/projects">Assign from project members</Link>
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg">Leave calendar (users without projects)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track pending and approved upcoming leave for unassigned users in one place.
          </p>
        </div>
        <CardContent className="p-6">
          {schedulerEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming leave events for unassigned users.</p>
          ) : (
            <TeamScheduler events={schedulerEvents} members={schedulerMembers} showMemberFilters />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

