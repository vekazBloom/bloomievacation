'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const TeamScheduler = dynamic(
  () => import('@/components/calendar/team-scheduler').then((module) => module.TeamScheduler),
  {
    loading: () => (
      <div className="h-[28rem] animate-pulse rounded-xl border border-border bg-muted/30" />
    ),
  }
);

export function TeamSchedulerLazy(props: ComponentProps<typeof TeamScheduler>) {
  return <TeamScheduler {...props} />;
}
