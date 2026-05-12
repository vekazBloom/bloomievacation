import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDashboardSession();
  if (!session) redirect('/login');

  const { profile, projects } = session;

  return (
    <DashboardShell
      profile={profile}
      projects={projects}
      isSystemAdmin={profile.is_system_admin}
    >
      {children}
    </DashboardShell>
  );
}
