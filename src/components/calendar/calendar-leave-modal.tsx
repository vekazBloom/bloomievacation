'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { leaveChipClasses } from '@/lib/calendar/scheduler-theme';
import { formatDateRange, getInitials } from '@/lib/utils';
import { projectPath } from '@/lib/projects/paths';
import type { SchedulerEvent } from '@/components/calendar/team-scheduler';

type CalendarLeaveModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  events: SchedulerEvent[];
  canReview?: boolean;
  projectSlug?: string;
  onApprove?: (eventId: string) => void;
  onReject?: (eventId: string) => void;
};

export function CalendarLeaveModal({
  open,
  onOpenChange,
  title,
  subtitle,
  events,
  canReview = false,
  projectSlug,
  onApprove,
  onReject,
}: CalendarLeaveModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(100%-2rem,32rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-xl">{title}</Dialog.Title>
              {subtitle ? <Dialog.Description className="mt-1 text-sm text-muted-foreground">{subtitle}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild>
              <Button type="button" size="icon" variant="ghost" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="mt-5 space-y-3">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No one is off on the selected day(s).</p>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className={`rounded-lg border px-3 py-3 ${leaveChipClasses(event.status, event.type)}`}
                >
                  <div className="flex items-start gap-3">
                    {event.type === 'national' ? (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-semibold">
                        NH
                      </div>
                    ) : (
                      <Avatar className="h-9 w-9">
                        {event.avatarUrl ? <AvatarImage src={event.avatarUrl} alt={event.title} /> : null}
                        <AvatarFallback className="text-xs">{getInitials(event.title)}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{event.title}</p>
                      <p className="text-sm opacity-80">
                        {formatDateRange(event.startDate, event.endDate)}
                        {event.subtitle ? ` · ${event.subtitle}` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="uppercase">
                          {event.status || event.type}
                        </Badge>
                        {event.userId && projectSlug ? (
                          <Button asChild variant="outline" size="sm">
                            <Link href={projectPath(projectSlug, 'members', event.userId)}>
                              Open profile
                            </Link>
                          </Button>
                        ) : null}
                        {canReview && event.status === 'pending' && event.type !== 'national' ? (
                          <>
                            <Button type="button" size="sm" onClick={() => onApprove?.(event.id)}>
                              Approve
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => onReject?.(event.id)}>
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
