import { differenceInCalendarDays, format, startOfDay } from 'date-fns';

/** Calendar date in local time, clamping day to the last day of the month. */
export function calendarDateInYear(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month, 0).getDate();
  const d = Math.min(Math.max(1, day), lastDay);
  return new Date(year, month - 1, d);
}

/**
 * Next calendar occurrence of month/day strictly after `from` (same day counts as "today or future" if from is start of that day, we use > from startOfDay).
 */
export function nextOccurrenceOfMonthDay(month: number, day: number, from: Date = new Date()): Date {
  const t = startOfDay(from);
  let y = t.getFullYear();
  let candidate = calendarDateInYear(y, month, day);
  if (candidate.getTime() <= t.getTime()) {
    candidate = calendarDateInYear(y + 1, month, day);
  }
  return candidate;
}

export type PolicyMilestone = {
  /** yyyy-MM-dd in local calendar */
  iso: string;
  date: Date;
  /** Whole calendar days from start of `from` until milestone (can be 0 if milestone is today). */
  daysUntil: number;
};

export function milestoneForMonthDay(
  month: number,
  day: number,
  from: Date = new Date()
): PolicyMilestone {
  const date = nextOccurrenceOfMonthDay(month, day, from);
  const iso = format(date, 'yyyy-MM-dd');
  const daysUntil = differenceInCalendarDays(date, startOfDay(from));
  return { iso, date, daysUntil };
}

export function formatPolicyDate(date: Date, locale?: string): string {
  return date.toLocaleDateString(locale ?? 'en-GB', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
