import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Parses `YYYY-MM-DD` (and ISO strings) as a local calendar date to avoid UTC off-by-one in ranges. */
export function calendarDateFromInput(input: string | Date): Date {
  if (typeof input !== 'string') return input;
  const dayPart = input.split('T')[0] ?? input;
  const parts = dayPart.split('-').map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return new Date(input);
  return new Date(y, m - 1, d);
}

export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const d = calendarDateFromInput(date);
  if (format === 'long') {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateRange(start: string | Date, end: string | Date): string {
  const s = calendarDateFromInput(start);
  const e = calendarDateFromInput(end);

  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate()) {
    return formatDate(s);
  }

  const yS = s.getFullYear();
  const yE = e.getFullYear();
  const mS = s.getMonth();
  const mE = e.getMonth();
  const dS = s.getDate();
  const dE = e.getDate();

  if (yS === yE && mS === mE) {
    const month = s.toLocaleDateString('en-US', { month: 'short' });
    return `${month} ${dS} – ${month} ${dE}, ${yS}`;
  }

  if (yS === yE) {
    const left = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const right = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${left} – ${right}, ${yS}`;
  }

  return `${formatDate(s)} – ${formatDate(e)}`;
}
