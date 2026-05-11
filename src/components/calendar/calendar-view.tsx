'use client';

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { formatDateRange } from '@/lib/utils';

type CalendarEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
};

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  const eventDays = events.flatMap((event) => {
    const days: Date[] = [];
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <DayPicker mode="multiple" selected={eventDays} showOutsideDays className="rounded-lg border border-border p-3" />
      <div className="space-y-3">
        {events.map((event) => (
          <div key={event.id} className="rounded-md border border-border px-4 py-3 text-sm">
            <p className="font-medium">{event.title}</p>
            <p className="text-muted-foreground">
              {formatDateRange(event.startDate, event.endDate)} · {event.type} · {event.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
