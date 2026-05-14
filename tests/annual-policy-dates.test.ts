import assert from 'node:assert/strict';
import test from 'node:test';
import { format } from 'date-fns';
import {
  calendarDateInYear,
  milestoneForMonthDay,
  nextOccurrenceOfMonthDay,
} from '../src/lib/leave/annual-policy-dates';

test('calendarDateInYear clamps day to last day of month', () => {
  const d = calendarDateInYear(2025, 2, 31);
  assert.equal(format(d, 'yyyy-MM-dd'), '2025-02-28');
});

test('nextOccurrenceOfMonthDay returns same year when still ahead', () => {
  const from = new Date(2025, 4, 10); // 10 May 2025
  const next = nextOccurrenceOfMonthDay(6, 1, from); // 1 Jun 2025
  assert.equal(format(next, 'yyyy-MM-dd'), '2025-06-01');
});

test('nextOccurrenceOfMonthDay rolls to next year after date passed', () => {
  const from = new Date(2025, 6, 15); // 15 Jul 2025
  const next = nextOccurrenceOfMonthDay(6, 1, from);
  assert.equal(format(next, 'yyyy-MM-dd'), '2026-06-01');
});

test('milestoneForMonthDay exposes daysUntil from start of today', () => {
  const from = new Date(2025, 0, 10);
  const m = milestoneForMonthDay(1, 15, from);
  assert.equal(m.iso, '2025-01-15');
  assert.ok(m.daysUntil >= 0);
});
