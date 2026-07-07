import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsIso,
  computeRoadmapMonths,
  monthSpanLength,
} from '../src/lib/roadmap/months';
import { statusChipClasses, STATUS_ORDER } from '../src/lib/roadmap/status-theme';

test('computeRoadmapMonths defaults to the Apr–Nov 2026 window', () => {
  const months = computeRoadmapMonths([]);
  assert.equal(months.length, 8);
  assert.equal(months[0].iso, '2026-04-01');
  assert.equal(months[0].label, 'Apr');
  assert.equal(months[7].iso, '2026-11-01');
});

test('computeRoadmapMonths grows the window to cover out-of-range items', () => {
  const months = computeRoadmapMonths([
    { start_month: '2026-01-01', end_month: '2026-02-01' },
    { start_month: '2026-12-01', end_month: '2027-01-01' },
  ]);
  assert.equal(months[0].iso, '2026-01-01');
  assert.equal(months[months.length - 1].iso, '2027-01-01');
  assert.equal(months.length, 13);
});

test('computeRoadmapMonths ignores unscheduled (null) items', () => {
  const months = computeRoadmapMonths([{ start_month: null, end_month: null }]);
  assert.equal(months.length, 8);
});

test('monthSpanLength is the whole-month distance (0 for same month)', () => {
  assert.equal(monthSpanLength('2026-04-01', '2026-04-01'), 0);
  assert.equal(monthSpanLength('2026-04-01', '2026-07-01'), 3);
  assert.equal(monthSpanLength('2026-11-01', '2027-01-01'), 2);
});

test('addMonthsIso shifts by whole months across year boundaries', () => {
  assert.equal(addMonthsIso('2026-11-01', 2), '2027-01-01');
  assert.equal(addMonthsIso('2026-04-01', -1), '2026-03-01');
});

test('every status maps to a chip class', () => {
  for (const status of STATUS_ORDER) {
    assert.equal(typeof statusChipClasses(status), 'string');
    assert.ok(statusChipClasses(status).length > 0);
  }
});
