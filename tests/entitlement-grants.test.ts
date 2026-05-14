import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dateInGrantWindow,
  grantRemaining,
  grantsEligibleForStartDate,
  validateAllocationTotals,
  type AnnualGrantRow,
} from '../src/lib/leave/entitlement-grants';

const g2025: AnnualGrantRow = {
  id: 'a',
  project_id: 'p',
  user_id: 'u',
  grant_year: 2025,
  label: '2025',
  days_allocated: 10,
  valid_from: '2025-01-01',
  valid_to: '2026-07-01',
  source: 'grant',
};

const g2026: AnnualGrantRow = {
  id: 'b',
  project_id: 'p',
  user_id: 'u',
  grant_year: 2026,
  label: '2026',
  days_allocated: 12,
  valid_from: '2026-01-01',
  valid_to: '2027-07-01',
  source: 'grant',
};

test('dateInGrantWindow respects inclusive bounds', () => {
  assert.equal(dateInGrantWindow(g2025, '2025-01-01'), true);
  assert.equal(dateInGrantWindow(g2025, '2026-07-01'), true);
  assert.equal(dateInGrantWindow(g2025, '2026-07-02'), false);
});

test('grantsEligibleForStartDate returns overlapping funds', () => {
  const eligible = grantsEligibleForStartDate([g2025, g2026], '2026-03-15');
  assert.equal(eligible.length, 2);
});

test('validateAllocationTotals enforces sum and positivity', () => {
  assert.equal(validateAllocationTotals([{ grantId: 'a', workingDays: 3 }, { grantId: 'b', workingDays: 2 }], 5).ok, true);
  assert.equal(validateAllocationTotals([{ grantId: 'a', workingDays: 3 }, { grantId: 'b', workingDays: 2 }], 6).ok, false);
  assert.equal(validateAllocationTotals([{ grantId: 'a', workingDays: 0 }], 0).ok, false);
});

test('grantRemaining subtracts consumed', () => {
  assert.equal(grantRemaining(g2025, 4), 6);
});
