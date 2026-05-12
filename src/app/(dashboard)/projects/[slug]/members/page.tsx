import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AddExistingMemberForm } from '@/components/projects/add-existing-member-form';
import { InviteMemberForm } from '@/components/projects/invite-member-form';
import { MemberManagerRow } from '@/components/projects/member-manager-row';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatEmailDate, formatRoleLabel } from '@/lib/email/format';
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

  for (const member of members || []) {
    const email = (member as { users?: { email?: string } }).users?.email;
    if (email) {
      await closePendingInvitationsForEmail(service, projectId, email);
    }
  }

  const { data: invitations } = await supabase
    .from('invitations')
    .select('email, role, expires_at, accepted_at, created_at')
    .eq('project_id', projectId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

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
            <MemberManagerRow key={member.id} projectSlug={project.slug} member={member} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-display text-lg">Pending invitations</h2>
        </div>
        <CardContent className="divide-y divide-border p-0">
          {(invitations || []).length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">No pending invitations.</p>
          ) : (
            invitations?.map((invite) => (
              <div
                key={`${invite.email}-${invite.created_at}`}
                className="flex items-center justify-between px-6 py-4"
              >
                <div>
                  <p className="font-medium">{invite.email}</p>
                  <p className="text-sm text-muted-foreground">
                    Expires {formatEmailDate(invite.expires_at)}
                  </p>
                </div>
                <Badge variant="outline" className="font-mono uppercase">
                  {formatRoleLabel(invite.role)}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
