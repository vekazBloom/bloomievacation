import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOL_DEFINITIONS, buildToolsForUser } from '../src/lib/bot/tools/definitions';
import type { ToolTier } from '../src/lib/bot/user-context';

function toolNamesForTiers(tiers: ToolTier[]) {
  return buildToolsForUser(new Set(tiers)).map((t) => t.function.name).sort();
}

const SYSTEM_ONLY_TOOLS = ['get_jira_config', 'list_jira_sprints', 'get_jira_sprint_analytics'];
const ADMIN_ONLY_TOOLS = [
  'list_project_invitations',
  'list_sent_invitations',
  'search_users_for_invite',
  'preview_invite_user',
];
const LEAD_ONLY_TOOLS = ['list_pending_team_requests', 'preview_review_leave_request'];

test('employee (base+team) does not get lead, admin, or system tools', () => {
  const names = toolNamesForTiers(['base', 'team']);
  for (const tool of [...LEAD_ONLY_TOOLS, ...ADMIN_ONLY_TOOLS, ...SYSTEM_ONLY_TOOLS]) {
    assert.equal(names.includes(tool), false, `employee should not have ${tool}`);
  }
  assert.ok(names.includes('get_my_profile'));
  assert.ok(names.includes('get_project_members'));
});

test('lead tier adds review tools but not admin or jira', () => {
  const names = toolNamesForTiers(['base', 'team', 'lead']);
  for (const tool of LEAD_ONLY_TOOLS) {
    assert.ok(names.includes(tool), `lead should have ${tool}`);
  }
  for (const tool of [...ADMIN_ONLY_TOOLS, ...SYSTEM_ONLY_TOOLS]) {
    assert.equal(names.includes(tool), false, `lead should not have ${tool}`);
  }
});

test('admin tier adds invitation tools but not jira', () => {
  const names = toolNamesForTiers(['base', 'team', 'lead', 'admin']);
  for (const tool of ADMIN_ONLY_TOOLS) {
    assert.ok(names.includes(tool), `admin should have ${tool}`);
  }
  for (const tool of SYSTEM_ONLY_TOOLS) {
    assert.equal(names.includes(tool), false, `admin should not have ${tool}`);
  }
});

test('system tier includes jira analytics tools', () => {
  const names = toolNamesForTiers(['base', 'team', 'lead', 'admin', 'system']);
  for (const tool of SYSTEM_ONLY_TOOLS) {
    assert.ok(names.includes(tool), `system admin should have ${tool}`);
  }
});

test('every tool definition has a unique name', () => {
  const names = TOOL_DEFINITIONS.map((t) => t.function.name);
  assert.equal(names.length, new Set(names).size);
});
