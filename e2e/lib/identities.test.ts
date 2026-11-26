import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRunId, runEmail, inviteCodeFor, assertThrowaway, ADMIN_EMAIL, MEMBER_EMAIL, RUN_EMAIL_RE } from './identities.ts';

test('run IDs are short, lowercase and unique', () => {
  const a = newRunId(); const b = newRunId();
  assert.match(a, /^[a-z0-9]{8}$/);
  assert.notEqual(a, b);
});

test('run emails and invite codes derive from the run ID', () => {
  assert.equal(runEmail('ab12cd34'), 'lol.e2e.bot+run-ab12cd34@gmail.com');
  assert.equal(inviteCodeFor('ab12cd34'), 'LOL-E2E-AB12CD34');
  assert.match(runEmail('ab12cd34'), RUN_EMAIL_RE);
});

test('persistent identities are never treated as throwaway', () => {
  assert.throws(() => assertThrowaway(ADMIN_EMAIL));
  assert.throws(() => assertThrowaway(MEMBER_EMAIL));
  assert.throws(() => assertThrowaway('someone@example.com'));
  assert.doesNotThrow(() => assertThrowaway(runEmail('ab12cd34')));
});
