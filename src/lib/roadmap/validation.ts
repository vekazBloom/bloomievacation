/** Both months must be set or both cleared, and end must be on/after start. */
export function monthSpanError(
  start: string | null | undefined,
  end: string | null | undefined
): string | null {
  const hasStart = Boolean(start);
  const hasEnd = Boolean(end);
  if (hasStart !== hasEnd) return 'Set both start and end month, or neither';
  if (start && end && end < start) return 'end_month must be on or after start_month';
  return null;
}
