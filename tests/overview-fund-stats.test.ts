import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMemberAnnualBalances,
  buildMemberAnnualBalancesByFund,
} from '../src/lib/projects/overview-fund-stats';

test('buildMemberAnnualBalancesByFund uses stored grant_id on allocations', () => {
  const definitions = [
    { id: 'def-2025', label: 'Godišnji 2025' },
    { id: 'def-2026', label: 'Godišnji 2026' },
  ];
  const grants = [
    {
      id: 'grant-2025',
      user_id: 'user-1',
      definition_id: 'def-2025',
      days_allocated: 21,
      valid_from: '2025-01-01',
      valid_to: '2026-07-01',
      grant_year: 2025,
      source: 'legacy_migration',
    },
    {
      id: 'grant-2026',
      user_id: 'user-1',
      definition_id: 'def-2026',
      days_allocated: 21,
      valid_from: '2026-01-01',
      valid_to: '2027-07-01',
      grant_year: 2026,
      source: 'grant',
    },
  ];
  const allocations = [
    {
      grant_id: 'grant-2025',
      leave_request_id: 'req-1',
      working_days: 5,
      leave_requests: {
        status: 'approved',
        type: 'annual',
        start_date: '2025-06-01',
        user_id: 'user-1',
      },
    },
    {
      grant_id: 'grant-2026',
      leave_request_id: 'req-2',
      working_days: 3,
      leave_requests: {
        status: 'approved',
        type: 'annual',
        start_date: '2026-03-01',
        user_id: 'user-1',
      },
    },
    {
      grant_id: 'grant-2025',
      leave_request_id: 'req-3',
      working_days: 7,
      leave_requests: {
        status: 'approved',
        type: 'annual',
        start_date: '2026-03-01',
        user_id: 'user-1',
      },
    },
  ];

  const balances = buildMemberAnnualBalancesByFund(definitions, grants, allocations);
  assert.deepEqual(balances['def-2025']['user-1'], { used: 12, total: 21, reserved: 12 });
  assert.deepEqual(balances['def-2026']['user-1'], { used: 3, total: 21, reserved: 3 });
});

test('buildMemberAnnualBalances falls back to start-date attribution without stored rows', () => {
  const definitions = [
    { id: 'def-2025', label: 'Godišnji 2025' },
    { id: 'def-2026', label: 'Godišnji 2026' },
  ];
  const grants = [
    {
      id: 'grant-2025',
      user_id: 'user-1',
      definition_id: 'def-2025',
      days_allocated: 21,
      valid_from: '2025-01-01',
      valid_to: '2026-07-01',
      grant_year: 2025,
      source: 'legacy_migration',
    },
    {
      id: 'grant-2026',
      user_id: 'user-1',
      definition_id: 'def-2026',
      days_allocated: 21,
      valid_from: '2026-01-01',
      valid_to: '2027-07-01',
      grant_year: 2026,
      source: 'grant',
    },
  ];
  const requests = [
    {
      id: 'req-3',
      user_id: 'user-1',
      status: 'approved',
      start_date: '2026-03-01',
      working_days_count: 7,
    },
  ];

  const balances = buildMemberAnnualBalances(definitions, grants, requests);
  assert.deepEqual(balances.byDefinition['def-2026']['user-1'], {
    used: 7,
    total: 21,
    reserved: 7,
  });
  assert.deepEqual(balances.byDefinition['def-2025']['user-1'], {
    used: 0,
    total: 21,
    reserved: 0,
  });
});

test('buildMemberAnnualBalancesByFund does not attribute other members leave to one user', () => {
  const definitions = [{ id: 'def-2026', label: 'Godišnji 2026' }];
  const grants = [
    {
      id: 'grant-a',
      user_id: 'user-a',
      definition_id: 'def-2026',
      days_allocated: 20,
      valid_from: '2026-01-01',
      valid_to: '2027-07-01',
      grant_year: 2026,
      source: 'grant',
    },
    {
      id: 'grant-b',
      user_id: 'user-b',
      definition_id: 'def-2026',
      days_allocated: 20,
      valid_from: '2026-01-01',
      valid_to: '2027-07-01',
      grant_year: 2026,
      source: 'grant',
    },
  ];
  const allocations = [
    {
      grant_id: 'grant-b',
      leave_request_id: 'req-b',
      working_days: 12,
      leave_requests: {
        status: 'approved',
        type: 'annual',
        start_date: '2026-04-01',
        user_id: 'user-b',
      },
    },
  ];

  const balances = buildMemberAnnualBalancesByFund(definitions, grants, allocations);
  assert.deepEqual(balances['def-2026']['user-a'], { used: 0, total: 20, reserved: 0 });
  assert.deepEqual(balances['def-2026']['user-b'], { used: 12, total: 20, reserved: 12 });
});
