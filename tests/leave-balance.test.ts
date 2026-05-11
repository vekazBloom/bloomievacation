import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAnnualAllowance,
  getPendingDays,
  validateLeaveBalance,
} from '../src/lib/leave/balance';

const membership = {
  annual_leave_total: 20,
  annual_leave_used: 5,
  annual_leave_carried_over: 2,
  sick_leave_total: 10,
  sick_leave_used: 1,
  religious_leave_total: 3,
  religious_leave_used: 0,
};

test('annual allowance includes carried-over days', () => {
  assert.equal(getAnnualAllowance(membership), 22);
});

test('pending requests reduce remaining balance', () => {
  const validation = validateLeaveBalance({
    membership,
    type: 'annual',
    workingDays: 10,
    pendingRequests: [{ id: 'pending-1', type: 'annual', working_days_count: 5 }],
  });

  assert.equal(validation.ok, true);
  assert.equal(getPendingDays([{ id: 'pending-1', type: 'annual', working_days_count: 5 }], 'annual'), 5);
});

test('rejects requests that exceed remaining balance', () => {
  const validation = validateLeaveBalance({
    membership,
    type: 'annual',
    workingDays: 20,
    pendingRequests: [{ id: 'pending-1', type: 'annual', working_days_count: 5 }],
  });

  assert.equal(validation.ok, false);
  if (!validation.ok) {
    assert.equal(validation.remaining, 12);
  }
});
