import assert from 'node:assert/strict';
import test from 'node:test';
import {
  allocationsChangeGrantSet,
  existingAllocationInputs,
  resolveDateEditAllocations,
} from '../src/lib/leave/resolve-date-edit-allocations';

const singleFund = [{ grant_id: 'g1', working_days: 12 }];
const splitFunds = [
  { grant_id: 'g1', working_days: 5 },
  { grant_id: 'g2', working_days: 7 },
];

test('single fund rescales to the new working day count when the request shrinks', () => {
  const result = resolveDateEditAllocations({ workingDays: 5, existing: singleFund });
  assert.deepEqual(result, { ok: true, allocations: [{ grantId: 'g1', workingDays: 5 }] });
});

test('single fund rescales upward when the request is extended', () => {
  const result = resolveDateEditAllocations({ workingDays: 18, existing: singleFund });
  assert.deepEqual(result, { ok: true, allocations: [{ grantId: 'g1', workingDays: 18 }] });
});

test('a request backed by no funds resolves to no allocations', () => {
  const result = resolveDateEditAllocations({ workingDays: 4, existing: [] });
  assert.deepEqual(result, { ok: true, allocations: [] });
});

test('rows without a grant id are ignored', () => {
  const result = resolveDateEditAllocations({
    workingDays: 3,
    existing: [{ grant_id: null, working_days: 2 }, ...singleFund],
  });
  assert.deepEqual(result, { ok: true, allocations: [{ grantId: 'g1', workingDays: 3 }] });
});

test('multi-fund request without an explicit split is rejected', () => {
  const result = resolveDateEditAllocations({ workingDays: 9, existing: splitFunds });
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.error : '', /split across multiple annual funds/);
});

test('explicit split must sum to the new working day count', () => {
  const result = resolveDateEditAllocations({
    workingDays: 9,
    existing: splitFunds,
    explicit: [
      { grantId: 'g1', workingDays: 5 },
      { grantId: 'g2', workingDays: 7 },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.error : '', /must equal the request working days \(9\)/);
});

test('explicit split summing to the new count is accepted', () => {
  const explicit = [
    { grantId: 'g1', workingDays: 4 },
    { grantId: 'g2', workingDays: 5 },
  ];
  const result = resolveDateEditAllocations({ workingDays: 9, existing: splitFunds, explicit });
  assert.deepEqual(result, { ok: true, allocations: explicit });
});

test('explicit split within the rounding tolerance is accepted', () => {
  const explicit = [{ grantId: 'g1', workingDays: 8.99 }];
  const result = resolveDateEditAllocations({ workingDays: 9, existing: singleFund, explicit });
  assert.equal(result.ok, true);
});

test('explicit allocations must each be greater than zero', () => {
  const result = resolveDateEditAllocations({
    workingDays: 9,
    existing: splitFunds,
    explicit: [
      { grantId: 'g1', workingDays: 9 },
      { grantId: 'g2', workingDays: 0 },
    ],
  });
  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.error : '', /greater than zero/);
});

test('a date range with no working days is rejected', () => {
  for (const workingDays of [0, -1, Number.NaN]) {
    const result = resolveDateEditAllocations({ workingDays, existing: singleFund });
    assert.equal(result.ok, false, `expected ${workingDays} to be rejected`);
    assert.match(result.ok === false ? result.error : '', /no working days/);
  }
});

test('rescaling the same fund is not a grant-set change', () => {
  assert.equal(allocationsChangeGrantSet(singleFund, [{ grantId: 'g1', workingDays: 5 }]), false);
});

test('moving days onto a different fund is a grant-set change', () => {
  assert.equal(allocationsChangeGrantSet(singleFund, [{ grantId: 'g2', workingDays: 12 }]), true);
  assert.equal(
    allocationsChangeGrantSet(singleFund, [
      { grantId: 'g1', workingDays: 6 },
      { grantId: 'g2', workingDays: 6 },
    ]),
    true
  );
  assert.equal(allocationsChangeGrantSet(splitFunds, [{ grantId: 'g1', workingDays: 12 }]), true);
});

test('existingAllocationInputs coerces stored numeric strings', () => {
  assert.deepEqual(existingAllocationInputs([{ grant_id: 'g1', working_days: '7.5' }]), [
    { grantId: 'g1', workingDays: 7.5 },
  ]);
});
