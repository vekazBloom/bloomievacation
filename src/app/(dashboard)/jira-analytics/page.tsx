import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { JiraAnalyticsClient } from '@/components/jira/jira-analytics-client';

export default async function JiraAnalyticsPage() {
  const session = await getDashboardSession();
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">JIRA ANALYTICS</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select any sprint from board 166, run manual SYNC, and view snapshot analytics.
        </p>
      </div>
      <JiraAnalyticsClient isSystemAdmin={session.profile.is_system_admin} />
    </div>
  );
}
