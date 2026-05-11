import { redirect } from 'next/navigation';
import { reconcileAcceptedInvitationsForUser } from '@/lib/invitations/status';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  // Self-heal: if auth user exists but no profile row, create one.
  if (!profile) {
    await supabase.from('users').upsert({
      id: user.id,
      email: user.email!,
      name: (user.user_metadata?.name as string) || user.email!.split('@')[0],
    });
  }

  if (user.email) {
    await reconcileAcceptedInvitationsForUser(createServiceClient(), user.id, user.email);
  }

  // Get user's projects (for sidebar).
  const { data: memberships } = await supabase
    .from('project_members')
    .select('role, projects(id, name, logo_url, is_archived)')
    .eq('user_id', user.id);

  const projects =
    (memberships || [])
      .map((m: any) => ({ ...m.projects, role: m.role }))
      .filter((p: any) => p && !p.is_archived) || [];

  const profileData = profile || {
    id: user.id,
    email: user.email!,
    name: user.email!.split('@')[0],
    avatar_url: null,
    is_system_admin: false,
  };

  return (
    <DashboardShell
      profile={profileData}
      projects={projects}
      isSystemAdmin={profileData.is_system_admin}
    >
      {children}
    </DashboardShell>
  );
}
