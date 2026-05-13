'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { toast } from 'sonner';
import { CalendarLeaveModal } from '@/components/calendar/calendar-leave-modal';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { leaveChipClasses } from '@/lib/calendar/scheduler-theme';
import { formatDateRange, getInitials } from '@/lib/utils';
import { projectPath } from '@/lib/projects/paths';

export type SchedulerEvent = {
  id: string;
  title: string;
  subtitle?: string;
  startDate: string;
  endDate: string;
  type: 'annual' | 'sick' | 'religious' | 'national';
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  userId?: string;
  avatarUrl?: string;
  /** When set, overrides global `canReview` for approve/reject (cross-project team calendar). */
  canReviewThisRequest?: boolean;
};

export type SchedulerMember = {
  id: string;
  name: string;
};

type TeamSchedulerProps = {
  events: SchedulerEvent[];
  members?: SchedulerMember[];
  canReview?: boolean;
  projectSlug?: string;
  showMemberFilters?: boolean;
};

const leaveTypes = ['annual', 'sick', 'religious', 'national'] as const;

function eventMatchesDay(event: SchedulerEvent, day: Date) {
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  return isWithinInterval(day, { start, end });
}

function isDayInRange(day: Date, from: Date, to: Date) {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return isWithinInterval(day, { start, end });
}

function EventChip({
  event,
  onSelect,
}: {
  event: SchedulerEvent;
  onSelect: () => void;
}) {
  const tooltip = [event.title, event.subtitle].filter(Boolean).join(' — ');
  return (
    <div
      role="button"
      tabIndex={0}
      title={tooltip}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect();
      }}
      onKeyDown={(keydownEvent) => {
        if (keydownEvent.key === 'Enter' || keydownEvent.key === ' ') {
          keydownEvent.preventDefault();
          keydownEvent.stopPropagation();
          onSelect();
        }
      }}
      className={`flex w-full min-w-0 items-center gap-1.5 truncate rounded border px-1.5 py-0.5 text-left text-[11px] ${leaveChipClasses(
        event.status,
        event.type
      )}`}
    >
      {event.type === 'national' ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/70 text-[9px] font-semibold">
          NH
        </span>
      ) : (
        <Avatar className="h-4 w-4 shrink-0">
          {event.avatarUrl ? <AvatarImage src={event.avatarUrl} alt={event.title} /> : null}
          <AvatarFallback className="text-[8px]">{getInitials(event.title)}</AvatarFallback>
        </Avatar>
      )}
      <span className="truncate">{event.title}</span>
    </div>
  );
}

export function TeamScheduler({
  events,
  members = [],
  canReview = false,
  projectSlug,
  showMemberFilters = true,
}: TeamSchedulerProps) {
  const router = useRouter();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());
  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState<string[]>([...leaveTypes]);
  const [activeMembers, setActiveMembers] = useState<string[]>(members.map((member) => member.id));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [rangeAnchor, setRangeAnchor] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (event.status === 'rejected' || event.status === 'cancelled') return false;
      if (!activeTypes.includes(event.type)) return false;
      if (showMemberFilters && event.userId && activeMembers.length > 0 && !activeMembers.includes(event.userId)) {
        return false;
      }
      if (search.trim()) {
        const haystack = `${event.title} ${event.subtitle || ''}`.toLowerCase();
        if (!haystack.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [events, activeTypes, activeMembers, search, showMemberFilters]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, SchedulerEvent[]>();

    for (const event of filteredEvents) {
      const start = parseISO(event.startDate);
      const end = parseISO(event.endDate);
      const cursor = new Date(start);

      while (cursor <= end) {
        const key = format(cursor, 'yyyy-MM-dd');
        const bucket = map.get(key);
        if (bucket) {
          bucket.push(event);
        } else {
          map.set(key, [event]);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return map;
  }, [filteredEvents]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const weekStart = startOfWeek(selectedDay || month, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    return day;
  });

  const selectedEvent = filteredEvents.find((event) => event.id === selectedEventId) || null;
  const selectedDayEvents = selectedDay
    ? eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) || []
    : [];

  const modalEvents = useMemo(() => {
    if (!rangeAnchor || !rangeEnd) return [];
    const start = rangeAnchor <= rangeEnd ? rangeAnchor : rangeEnd;
    const end = rangeAnchor <= rangeEnd ? rangeEnd : rangeAnchor;
    const days = eachDayOfInterval({ start, end });
    const seen = new Set<string>();
    const list: SchedulerEvent[] = [];

    for (const event of filteredEvents) {
      if (days.some((day) => eventMatchesDay(event, day)) && !seen.has(event.id)) {
        seen.add(event.id);
        list.push(event);
      }
    }

    return list;
  }, [filteredEvents, rangeAnchor, rangeEnd]);

  const modalTitle = useMemo(() => {
    if (!rangeAnchor || !rangeEnd) return 'Who is off';
    if (isSameDay(rangeAnchor, rangeEnd)) {
      return format(rangeAnchor, 'EEEE, MMM d');
    }
    const start = rangeAnchor <= rangeEnd ? rangeAnchor : rangeEnd;
    const end = rangeAnchor <= rangeEnd ? rangeEnd : rangeAnchor;
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
  }, [rangeAnchor, rangeEnd]);

  async function reviewRequest(eventId: string, action: 'approve' | 'reject') {
    const response = await fetch(`/api/leave-requests/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      toast.error(payload.error || 'Failed to update request');
      return;
    }
    toast.success(`Request ${action}d`);
    setSelectedEventId(null);
    setModalOpen(false);
    router.refresh();
  }

  function openDayModal(day: Date, shiftKey: boolean) {
    setSelectedDay(day);

    if (shiftKey && rangeAnchor) {
      setRangeEnd(day);
      setModalOpen(true);
      return;
    }

    setRangeAnchor(day);
    setRangeEnd(day);
    setModalOpen(true);
  }

  function toggleType(type: string) {
    setActiveTypes((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : [...current, type]
    );
  }

  function toggleMember(memberId: string) {
    setActiveMembers((current) =>
      current.includes(memberId)
        ? current.filter((value) => value !== memberId)
        : [...current, memberId]
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button type="button" size="icon" variant="ghost" onClick={() => setMonth(subMonths(month, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-display text-xl">{format(month, 'MMMM yyyy')}</h2>
            <Button type="button" size="icon" variant="ghost" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted-foreground">
              Click a day to see who is off. Shift+click another day to select a range.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>
              Today
            </Button>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            Approved
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            Pending
          </span>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="min-w-[840px]">
            <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                <div key={label} className="px-2 py-2">
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthDays.map((day) => {
                const dayEvents = eventsByDay.get(format(day, 'yyyy-MM-dd')) || [];
                const isOutside = !isSameMonth(day, month);
                const isSelected =
                  rangeAnchor && rangeEnd
                    ? isDayInRange(day, rangeAnchor, rangeEnd)
                    : selectedDay
                      ? isSameDay(day, selectedDay)
                      : false;

                return (
                  <div
                    key={day.toISOString()}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => openDayModal(day, event.shiftKey)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openDayModal(day, event.shiftKey);
                      }
                    }}
                    className={`min-h-28 cursor-pointer border-b border-r border-border p-2 text-left transition-colors ${
                      isOutside ? 'bg-muted/20 text-muted-foreground' : 'bg-card'
                    } ${isSelected ? 'ring-2 ring-inset ring-primary/40' : ''}`}
                  >
                    <span className="text-sm font-medium">{format(day, 'd')}</span>
                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <EventChip
                          key={`${event.id}-${day.toISOString()}`}
                          event={event}
                          onSelect={() => {
                            setSelectedEventId(event.id);
                            setSelectedDay(day);
                          }}
                        />
                      ))}
                      {dayEvents.length > 3 ? (
                        <p className="text-[11px] text-muted-foreground">+ {dayEvents.length - 3} more</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="w-full min-w-0 overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <div className="mx-auto w-fit min-w-0 [--rdp-cell-size:2.25rem] [&_.rdp]:m-0 [&_.rdp]:max-w-full">
              <DayPicker
                mode="single"
                selected={selectedDay}
                onSelect={(day) => {
                  if (!day) return;
                  openDayModal(day, false);
                }}
                month={month}
                onMonthChange={setMonth}
                showOutsideDays
                className="text-sm"
              />
            </div>
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Match events"
          />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Event types</p>
            {leaveTypes.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm capitalize">
                <input
                  type="checkbox"
                  checked={activeTypes.includes(type)}
                  onChange={() => toggleType(type)}
                />
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                {type}
              </label>
            ))}
          </div>
          {showMemberFilters && members.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team members</p>
              {members.map((member) => (
                <label key={member.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={activeMembers.includes(member.id)}
                    onChange={() => toggleMember(member.id)}
                  />
                  {member.name}
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg">Week schedule</h3>
              <span className="text-sm text-muted-foreground">
                {format(weekDays[0], 'MMM d')} – {format(weekDays[6], 'MMM d')}
              </span>
            </div>
            <div className="overflow-x-auto pb-1">
              <div className="grid min-w-[840px] grid-cols-7 gap-2">
                {weekDays.map((day) => {
                  const dayEvents = filteredEvents.filter((event) => eventMatchesDay(event, day));
                  return (
                    <div
                      key={`week-${day.toISOString()}`}
                      className="min-h-48 min-w-0 rounded-lg border border-border bg-muted/10 p-2"
                    >
                      <p className="mb-2 text-xs font-medium text-muted-foreground">{format(day, 'EEE d')}</p>
                      <div className="space-y-2">
                        {dayEvents.map((event) => (
                          <EventChip
                            key={`${event.id}-week-${day.toISOString()}`}
                            event={event}
                            onSelect={() => setSelectedEventId(event.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="font-display text-lg">
              {selectedDay ? format(selectedDay, 'EEEE, MMM d') : 'Selected day'}
            </h3>
            <div className="mt-3 space-y-3">
              {selectedDayEvents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">No events for this day.</p>
                </div>
              ) : (
                selectedDayEvents.map((event) => (
                  <button
                    key={`selected-${event.id}`}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className={`flex w-full items-start justify-between gap-3 rounded-lg border px-3 py-2 text-left ${leaveChipClasses(
                      event.status,
                      event.type
                    )}`}
                  >
                    <div className="flex items-start gap-3">
                      {event.type !== 'national' ? (
                        <Avatar className="h-8 w-8">
                          {event.avatarUrl ? <AvatarImage src={event.avatarUrl} alt={event.title} /> : null}
                          <AvatarFallback className="text-xs">{getInitials(event.title)}</AvatarFallback>
                        </Avatar>
                      ) : null}
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm opacity-80">
                          {formatDateRange(event.startDate, event.endDate)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="uppercase">
                      {event.status || event.type}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </div>

          {selectedEvent ? (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                {selectedEvent.type !== 'national' ? (
                  <Avatar className="h-10 w-10">
                    {selectedEvent.avatarUrl ? (
                      <AvatarImage src={selectedEvent.avatarUrl} alt={selectedEvent.title} />
                    ) : null}
                    <AvatarFallback>{getInitials(selectedEvent.title)}</AvatarFallback>
                  </Avatar>
                ) : null}
                <div>
                  <h3 className="font-display text-lg">{selectedEvent.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatDateRange(selectedEvent.startDate, selectedEvent.endDate)} · {selectedEvent.type}
                  </p>
                  {selectedEvent.subtitle ? (
                    <p className="mt-2 text-sm text-muted-foreground">{selectedEvent.subtitle}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedEvent.userId && projectSlug ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={projectPath(projectSlug, 'members', selectedEvent.userId)}>
                      Open profile
                    </Link>
                  </Button>
                ) : null}
                {((selectedEvent.canReviewThisRequest ?? canReview) &&
                  selectedEvent.status === 'pending' &&
                  selectedEvent.type !== 'national') ? (
                  <>
                    <Button type="button" size="sm" onClick={() => reviewRequest(selectedEvent.id, 'approve')}>
                      Approve
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => reviewRequest(selectedEvent.id, 'reject')}>
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <CalendarLeaveModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={modalTitle}
        subtitle={
          rangeAnchor && rangeEnd && !isSameDay(rangeAnchor, rangeEnd)
            ? 'Everyone off during the selected range'
            : 'Everyone off on the selected day'
        }
        events={modalEvents}
        canReview={canReview}
        projectSlug={projectSlug}
        onApprove={(eventId) => reviewRequest(eventId, 'approve')}
        onReject={(eventId) => reviewRequest(eventId, 'reject')}
      />
    </div>
  );
}
