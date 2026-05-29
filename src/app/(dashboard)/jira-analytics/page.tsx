import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/auth/dashboard';

// Lazy-load the analytics client so Recharts (~120 kb) is only fetched when
// this page is actually visited — keeps the main bundle lean.
const JiraAnalyticsClient = dynamic(
  () =>
    import('@/components/jira/jira-analytics-client').then((m) => ({
      default: m.JiraAnalyticsClient,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    ),
  }
);

export default async function JiraAnalyticsPage() {
  const session = await getDashboardSession();
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-6xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Jira Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select a sprint, run a manual sync, and view snapshot analytics for your board.
        </p>
      </div>
      <JiraAnalyticsClient isSystemAdmin={session.profile.is_system_admin} />
    </div>
  );
}
