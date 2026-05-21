import assert from 'node:assert/strict';
import test from 'node:test';
import {
  dateInGrantWindow,
  grantRemaining,
  grantsEligibleForStartDate,
  pickBestGrantForStartDate,
  resolveGrantBookableEnd,
  validateAllocationTotals,
  type AnnualGrantRow,
} from '../src/lib/leave/entitlement-grants';
import { fundPeriodLabelForAnchor } from '../src/lib/leave/fund-period-label';

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

test('resolveGrantBookableEnd extends stored valid_to to first-use-by deadline', () => {
  assert.equal(resolveGrantBookableEnd(g2025, 7, 1), '2026-07-01');
  assert.equal(resolveGrantBookableEnd({ ...g2025, valid_to: '2025-12-31' }, 7, 1), '2026-07-01');
  assert.equal(resolveGrantBookableEnd(g2025, null, null), '2026-07-01');
});

test('pickBestGrantForStartDate prefers grant_year matching start year', () => {
  const legacy2025: AnnualGrantRow = {
    ...g2025,
    id: 'legacy',
    source: 'legacy_migration',
    valid_to: '2027-07-01',
  };
  const eligible = grantsEligibleForStartDate([legacy2025, g2026], '2026-03-15');
  const picked = pickBestGrantForStartDate(eligible, '2026-03-15');
  assert.equal(picked.id, g2026.id);
});

test('validateAllocationTotals enforces sum and positivity', () => {
  assert.equal(validateAllocationTotals([{ grantId: 'a', workingDays: 3 }, { grantId: 'b', workingDays: 2 }], 5).ok, true);
  assert.equal(validateAllocationTotals([{ grantId: 'a', workingDays: 3 }, { grantId: 'b', workingDays: 2 }], 6).ok, false);
  assert.equal(validateAllocationTotals([{ grantId: 'a', workingDays: 0 }], 0).ok, false);
});

test('grantRemaining subtracts consumed', () => {
  assert.equal(grantRemaining(g2025, 4), 6);
});

test('fundPeriodLabelForAnchor classifies vs leave start', () => {
  assert.equal(fundPeriodLabelForAnchor('2025-06-01', '2025-01-01', '2025-12-31'), 'Active');
  assert.equal(fundPeriodLabelForAnchor('2024-12-01', '2025-01-01', '2025-12-31'), 'Future');
  assert.equal(fundPeriodLabelForAnchor('2026-06-01', '2025-01-01', '2025-12-31'), 'Past');
  assert.equal(fundPeriodLabelForAnchor('2025-06-01', '2025-01-01', null), 'Active');
});
