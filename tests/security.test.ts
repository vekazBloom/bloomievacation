import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidSickLeaveAttachmentPath } from '../src/lib/security/attachment';
import { sanitizeInternalRedirectPath } from '../src/lib/security/redirect';
import { escapeIlikePattern, sanitizeUserSearchQuery } from '../src/lib/security/search';

test('sanitizeInternalRedirectPath allows internal paths only', () => {
  assert.equal(sanitizeInternalRedirectPath('/dashboard'), '/dashboard');
  assert.equal(sanitizeInternalRedirectPath('https://evil.com'), '/dashboard');
  assert.equal(sanitizeInternalRedirectPath('//evil.com'), '/dashboard');
});

test('isValidSickLeaveAttachmentPath requires the request owner prefix', () => {
  const userId = 'a8a15d8f-1367-4476-b704-09099d803f6e';
  assert.equal(
    isValidSickLeaveAttachmentPath(`${userId}/2026-05-11-note.pdf`, userId),
    true
  );
  assert.equal(
    isValidSickLeaveAttachmentPath('b8a15d8f-1367-4476-b704-09099d803f6e/2026-05-11-note.pdf', userId),
    false
  );
});

test('sanitizeUserSearchQuery strips PostgREST delimiters', () => {
  assert.equal(sanitizeUserSearchQuery('  vekaz,email.eq.x  '), 'vekaz email eq x');
});

test('escapeIlikePattern escapes wildcard characters', () => {
  assert.equal(escapeIlikePattern('100%_done'), '100\\%\\_done');
});
