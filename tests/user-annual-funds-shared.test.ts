import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeGrantsPerUserByDefinition } from '../src/lib/leave/user-annual-funds-shared';

test('mergeGrantsPerUserByDefinition keeps one shared pool per fund template', () => {
  const merged = mergeGrantsPerUserByDefinition([
    {
      id: 'grant-a',
      user_id: 'user-1',
      project_id: 'project-a',
      definition_id: 'def-2025',
      days_allocated: 20,
      valid_from: '2025-01-01',
      valid_to: '2026-07-01',
      source: 'legacy_migration',
    },
    {
      id: 'grant-b',
      user_id: 'user-1',
      project_id: 'project-b',
      definition_id: 'def-2025',
      days_allocated: 21,
      valid_from: '2025-01-01',
      valid_to: '2026-07-01',
      source: 'legacy_migration',
    },
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].days_allocated, 21);
  assert.equal(merged[0].definition_id, 'def-2025');
});
