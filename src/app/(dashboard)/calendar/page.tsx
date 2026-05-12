import { Suspense } from 'react';
import { PersonalCalendarFallback } from '@/components/calendar/personal-calendar-fallback';
import { PersonalCalendarSection } from '@/components/calendar/personal-calendar-section';

export default function PersonalCalendarPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-medium tracking-tight">My calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your approved and pending leave across all projects.
        </p>
      </div>

      <Suspense fallback={<PersonalCalendarFallback />}>
        <PersonalCalendarSection />
      </Suspense>
    </div>
  );
}
