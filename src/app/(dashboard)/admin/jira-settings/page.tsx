import { redirect } from 'next/navigation';
import { JiraSettingsPanel } from '@/components/jira/jira-settings-panel';
import { getDashboardSession } from '@/lib/auth/dashboard';

export default async function JiraSettingsPage() {
  const session = await getDashboardSession();
  if (!session) redirect('/login');
  if (!session.profile.is_system_admin) redirect('/dashboard');

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Jira Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure Jira connection, board options, and user delegation mappings.
        </p>
      </div>
      <JiraSettingsPanel />
    </div>
  );
}
