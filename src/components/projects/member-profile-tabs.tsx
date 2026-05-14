'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TabId = 'leave' | 'funds';

export function MemberProfileTabs({
  leaveLabel,
  fundsLabel,
  leaveContent,
  fundsContent,
}: {
  leaveLabel: string;
  fundsLabel: string;
  leaveContent: ReactNode;
  fundsContent: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>('leave');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('leave')}
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            tab === 'leave'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {leaveLabel}
        </button>
        <button
          type="button"
          onClick={() => setTab('funds')}
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
            tab === 'funds'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {fundsLabel}
        </button>
      </div>
      {tab === 'leave' ? leaveContent : fundsContent}
    </div>
  );
}
