import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber } from '../src/lib/phone/normalize';

test('normalizePhoneNumber formats E.164 with country code', () => {
  assert.equal(normalizePhoneNumber('+387 61 123 456'), '+38761123456');
});

test('normalizePhoneNumber adds default Bosnia code for local numbers', () => {
  assert.equal(normalizePhoneNumber('061 123 456'), '+38761123456');
});

test('normalizePhoneNumber returns null for empty input', () => {
  assert.equal(normalizePhoneNumber(''), null);
});
