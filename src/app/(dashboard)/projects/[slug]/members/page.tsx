import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AddExistingMemberForm } from '@/components/projects/add-existing-member-form';
import { InviteMemberForm } from '@/components/projects/invite-member-form';
import { MemberManagerRow } from '@/components/projects/member-manager-row';
import { PendingInvitationsTable } from '@/components/projects/pending-invitations-table';
import { UsersWithoutProjectsPanel } from '@/components/projects/users-without-projects-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getUserLeaveBalance } from '@/lib/leave/global-balance';
import {
  closePendingInvitationsForEmail,
  reconcileAcceptedInvitationMemberships,
} from '@/lib/invitations/status';
import { canManageProject, getCurrentUser } from '@/lib/projects/access';
import { projectPath } from '@/lib/projects/paths';
import { getProjectBySlug } from '@/lib/projects/resolve';
import { createServiceClient } from '@/lib/supabase/server';

export default async function ProjectMembersPage({ params }: { params: { slug: string } }) {
  const { supabase, user } = await getCurrentUser();
  if (!user) redirect('/login');

  const { project } = await getProjectBySlug(supabase, params.slug);
  if (!project) notFound();

  const projectId = project.id;

  const allowed = await canManageProject(projectId, user.id);
  if (!allowed) notFound();

  const service = createServiceClient();
  await reconcileAcceptedInvitationMemberships(service, projectId);

  const { data: members } = await supabase
    .from('project_members')
    .select(
      'id, role, annual_leave_total, sick_leave_total, religious_leave_total, users(id, name, email)'
    )
    .eq('project_id', projectId);

  const memberUserIds = (members || [])
    .map((member: any) => member.users?.id as string | undefined)
    .filter((id): id is string => Boolean(id));

  const { data: crossProjectMemberships } =
    memberUserIds.length > 0
      ? await supabase
          .from('project_members')
          .select('user_id, projects(name, slug, is_archived)')
          .in('user_id', memberUserIds)
          .neq('project_id', projectId)
      : { data: [] };

  const otherProjectsByUser = (crossProjectMemberships || []).reduce(
    (acc, membership: any) => {
      const userId = membership.user_id as string | undefined;
      const project = Array.isArray(membership.projects)
        ? membership.projects[0]
        : membership.projects;
      if (!userId || !project?.slug || !project?.name || project?.is_archived) return acc;
      const existing = acc.get(userId) || [];
      if (!existing.some((item) => item.slug === project.slug)) {
        existing.push({ slug: project.slug, name: project.name });
      }
      acc.set(userId, existing);
      return acc;
    },
    new Map<string, { slug: string; name: string }[]>()
  );

  for (const member of members || []) {
    const email = (member as { users?: { email?: string } }).users?.email;
    if (email) {
      await closePendingInvitationsForEmail(service, projectId, email);
    }
  }

  const { data: invitations } = await supabase
    .from('invitations')
    .select('id, email, role, expires_at, accepted_at, created_at')
    .eq('project_id', projectId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  const { data: allMemberships } = await supabase.from('project_members').select('user_id, project_id');
  const usersWithAnyProject = new Set((allMemberships || []).map((membership) => membership.user_id));

  const { data: allUsers } = await supabase.from('users').select('id, name, email').order('name', { ascending: true });
  const usersWithoutProjects = (allUsers || []).filter((memberUser) => !usersWithAnyProject.has(memberUser.id));

  const orphanUserIds = usersWithoutProjects.map((orphan) => orphan.id);
  const today = new Date().toISOString().split('T')[0];

  const { data: orphanActiveRequests } =
    orphanUserIds.length > 0
      ? await supabase
          .from('leave_requests')
          .select('user_id')
          .in('user_id', orphanUserIds)
          .in('status', ['pending', 'approved'])
          .gte('end_date', today)
      : { data: [] };

  const activeRequestCountByUser = (orphanActiveRequests || []).reduce(
    (acc, row) => {
      acc.set(row.user_id, (acc.get(row.user_id) || 0) + 1);
      return acc;
    },
    new Map<string, number>()
  );

  const orphanBalancesByUser = new Map<string, Awaited<ReturnType<typeof getUserLeaveBalance>>['data']>();
  for (const orphanId of orphanUserIds) {
    const { data: balance } = await getUserLeaveBalance(supabase, orphanId);
    orphanBalancesByUser.set(orphanId, balance);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={projectPath(project.slug)} aria-label="Back to project">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Manage members</h1>
          <p className="text-sm text-muted-foreground">{project.name}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <InviteMemberForm projectId={projectId} />
        <AddExistingMemberForm projectSlug={project.slug} />
      </div>

      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg">Current members</h2>
        </div>
        <CardContent className="p-0">
          {(members || []).map((member: any) => (
            <MemberManagerRow
              key={member.id}
              projectSlug={project.slug}
              member={member}
              otherProjects={otherProjectsByUser.get(member.users?.id) || []}
            />
          ))}
        </CardContent>
      </Card>

      <PendingInvitationsTable
        invitations={(invitations || []).map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expires_at: invite.expires_at,
          created_at: invite.created_at,
        }))}
      />

      <UsersWithoutProjectsPanel
        projectSlug={project.slug}
        users={usersWithoutProjects.map((orphan) => {
          const balance = orphanBalancesByUser.get(orphan.id);
          return {
            id: orphan.id,
            name: orphan.name,
            email: orphan.email,
            balances: balance
              ? {
                  annualTotal:
                    Number(balance.annual_leave_total || 0) +
                    Number(balance.annual_leave_carried_over || 0),
                  annualUsed: Number(balance.annual_leave_used || 0),
                  sickTotal: Number(balance.sick_leave_total || 0),
                  sickUsed: Number(balance.sick_leave_used || 0),
                  religiousTotal: Number(balance.religious_leave_total || 0),
                  religiousUsed: Number(balance.religious_leave_used || 0),
                }
              : null,
            upcomingRequestCount: activeRequestCountByUser.get(orphan.id) || 0,
          };
        })}
      />
    </div>
  );
}
