import assert from 'node:assert/strict';
import test from 'node:test';
import { getAnnualRemaining } from '../src/lib/carry-over/remaining';

test('annual remaining never goes below zero', () => {
  const remaining = getAnnualRemaining({
    user_id: 'user-1',
    annual_leave_total: 20,
    annual_leave_used: 25,
    annual_leave_carried_over: 0,
  });

  assert.equal(remaining, 0);
});

test('annual remaining includes carried-over days', () => {
  const remaining = getAnnualRemaining({
    user_id: 'user-1',
    annual_leave_total: 20,
    annual_leave_used: 5,
    annual_leave_carried_over: 3,
  });

  assert.equal(remaining, 18);
});
