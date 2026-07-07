import { notFound, redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/auth/dashboard';
import { getRoadmap } from '@/lib/read/roadmap';
import { RoadmapTimeline } from '@/components/roadmap/roadmap-timeline';

export const dynamic = 'force-dynamic';

export default async function RoadmapPage() {
  const session = await getDashboardSession();
  if (!session) redirect('/login');
  if (!session.profile.is_system_admin) notFound();

  const roadmap = await getRoadmap(session.supabase);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">Roadmap</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plan engineering work across the year. Drag a feature to reschedule it, or drag its edges
          to change its duration.
        </p>
      </div>
      <RoadmapTimeline initial={roadmap} />
    </div>
  );
}
