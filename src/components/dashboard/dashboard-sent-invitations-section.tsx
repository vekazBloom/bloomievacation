import { PendingInvitationsTable } from '@/components/projects/pending-invitations-table';
import { buildInviteRoleSummary } from '@/lib/email/format';
import type { AppSupabase } from '@/lib/supabase/app-client';

export async function DashboardSentInvitationsSection({
  supabase,
  userId,
}: {
  supabase: AppSupabase;
  userId: string;
}) {
  const { data: rows } = await supabase
    .from('invitations')
    .select(
      'id, email, role, expires_at, created_at, grant_system_admin, project_id, projects(name, slug)'
    )
    .eq('sent_by', userId)
    .is('accepted_at', null)
    .order('created_at', { ascending: false });

  const invitations = (rows || []).map((row) => {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    const hasProject = Boolean(row.project_id);
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      expires_at: row.expires_at,
      created_at: row.created_at,
      projectName: project?.name ?? null,
      projectSlug: project?.slug ?? null,
      roleSummary: buildInviteRoleSummary({
        projectRole: row.role,
        grantSystemAdmin: Boolean(row.grant_system_admin),
        hasProject,
      }),
    };
  });

  if (invitations.length === 0) {
    return null;
  }

  return (
    <PendingInvitationsTable
      title="Invitations you sent"
      description="These people have not accepted yet. Resend the invite email if needed."
      invitations={invitations}
    />
  );
}
