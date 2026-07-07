export type RoadmapMonth = {
  /** `YYYY-MM` sort/lookup key. */
  key: string;
  /** First-of-month ISO date, e.g. `2026-04-01`. */
  iso: string;
  year: number;
  /** 1-12. */
  month: number;
  label: string;
};

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Default visible window: April 2026 → November 2026 (the Harvest 2026 planning window). */
const DEFAULT_START = { year: 2026, month: 4 };
const DEFAULT_END = { year: 2026, month: 11 };

const toIndex = (year: number, month: number) => year * 12 + (month - 1);

export function parseMonth(value: string | null | undefined): { year: number; month: number } | null {
  if (!value) return null;
  const [y, m] = value.split('-');
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return { year, month };
}

/** `YYYY-MM-01` ISO date for a month column offset (in months) from a base month. */
export function addMonthsIso(iso: string, delta: number): string {
  const parsed = parseMonth(iso);
  if (!parsed) return iso;
  const idx = toIndex(parsed.year, parsed.month) + delta;
  const year = Math.floor(idx / 12);
  const month = (idx % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** Whole-month distance end - start (0 when same month). */
export function monthSpanLength(startIso: string, endIso: string): number {
  const s = parseMonth(startIso);
  const e = parseMonth(endIso);
  if (!s || !e) return 0;
  return toIndex(e.year, e.month) - toIndex(s.year, s.month);
}

/**
 * Ordered month columns for the timeline: the union of the default Apr–Nov 2026
 * window and the actual span of every scheduled item, so dragging an item earlier
 * or later than the window grows the grid rather than hiding it.
 */
export function computeRoadmapMonths(
  items: Array<{ start_month: string | null; end_month: string | null }>
): RoadmapMonth[] {
  let minIdx = toIndex(DEFAULT_START.year, DEFAULT_START.month);
  let maxIdx = toIndex(DEFAULT_END.year, DEFAULT_END.month);

  for (const item of items) {
    const start = parseMonth(item.start_month);
    const end = parseMonth(item.end_month);
    if (start) minIdx = Math.min(minIdx, toIndex(start.year, start.month));
    if (end) maxIdx = Math.max(maxIdx, toIndex(end.year, end.month));
  }

  const months: RoadmapMonth[] = [];
  for (let idx = minIdx; idx <= maxIdx; idx += 1) {
    const year = Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    months.push({
      key: `${year}-${String(month).padStart(2, '0')}`,
      iso: `${year}-${String(month).padStart(2, '0')}-01`,
      year,
      month,
      label: MONTH_LABELS[month - 1],
    });
  }
  return months;
}
