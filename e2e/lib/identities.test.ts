import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRunId, runEmail, inviteCodeFor, assertThrowaway, runIdFromEmail, ADMIN_EMAIL, MEMBER_EMAIL, NO_ACCOUNT_EMAIL, RUN_EMAIL_RE } from './identities.ts';

test('run IDs are short, lowercase and unique', () => {
  const a = newRunId(); const b = newRunId();
  assert.match(a, /^[a-z0-9]{8}$/);
  assert.notEqual(a, b);
});

test('run emails and invite codes derive from the run ID', () => {
  assert.equal(runEmail('ab12cd34'), 'lol.e2e.bot+run-ab12cd34@gmail.com');
  assert.equal(inviteCodeFor('ab12cd34'), 'E2E-AB12-CD34');
  assert.match(runEmail('ab12cd34'), RUN_EMAIL_RE);
});

test('invite codes survive the sign-up input mask unchanged', () => {
  const code = inviteCodeFor(newRunId());
  const raw = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 11);
  const masked = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
  assert.equal(masked, code);
});

test('invite codes match the sign-up input shape', () => {
  assert.match(inviteCodeFor(newRunId()), /^[A-Z0-9]{3}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
});

test('persistent identities are never treated as throwaway', () => {
  assert.throws(() => assertThrowaway(ADMIN_EMAIL));
  assert.throws(() => assertThrowaway(MEMBER_EMAIL));
  assert.throws(() => assertThrowaway('someone@example.com'));
  assert.doesNotThrow(() => assertThrowaway(runEmail('ab12cd34')));
});

test('assertThrowaway is exact: case, whitespace, length and prefix variants are rejected', () => {
  assert.throws(() => assertThrowaway('LOL.E2E.BOT+RUN-AB12CD34@GMAIL.COM'));
  assert.throws(() => assertThrowaway(` ${runEmail('ab12cd34')}`));
  assert.throws(() => assertThrowaway(`${runEmail('ab12cd34')} `));
  assert.throws(() => assertThrowaway('lol.e2e.bot+run-ab12cdb@gmail.com'));
  assert.throws(() => assertThrowaway('lol.e2e.bot+run-ab12cd345@gmail.com'));
  assert.throws(() => assertThrowaway('lol.e2e.bot+runx-ab12cd34@gmail.com'));
  assert.doesNotThrow(() => assertThrowaway(runEmail(newRunId())));
});

test('NO_ACCOUNT_EMAIL is a valid throwaway address', () => {
  assert.doesNotThrow(() => assertThrowaway(NO_ACCOUNT_EMAIL));
});

test("runIdFromEmail extracts the run ID and rejects every other address", () => {
  assert.equal(runIdFromEmail(runEmail("ab12cd34")), "ab12cd34");
  assert.throws(() => runIdFromEmail(ADMIN_EMAIL));
  assert.throws(() => runIdFromEmail(MEMBER_EMAIL));
  assert.throws(() => runIdFromEmail("lol.e2e.bot+run-ab12cd3@gmail.com"));
});
