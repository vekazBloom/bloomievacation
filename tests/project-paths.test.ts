import assert from 'node:assert/strict';
import test from 'node:test';
import { projectPath } from '../src/lib/projects/paths';

test('projectPath builds slug-based routes only', () => {
  assert.equal(projectPath('bloomie'), '/projects/bloomie');
  assert.equal(projectPath('bloomie', 'calendar'), '/projects/bloomie/calendar');
  assert.equal(projectPath('bloomie', 'members', 'user-1'), '/projects/bloomie/members/user-1');
});

test('projectPath encodes unsafe slug segments', () => {
  assert.equal(projectPath('team alpha'), '/projects/team%20alpha');
});
