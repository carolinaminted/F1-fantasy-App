import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySignIn, oobCodeFromResetLink } from './reset-link.ts';

const link = (host: string, mode = 'resetPassword') => `https://${host}/__/auth/action?mode=${mode}&oobCode=ABC123&apiKey=k&lang=en`;

test('takes the oobCode from a staging reset link', () => {
  assert.equal(oobCodeFromResetLink(link('formula-fantasy-staging.firebaseapp.com')), 'ABC123');
});

test('refuses a link for another project, another mode or no code', () => {
  assert.throws(() => oobCodeFromResetLink(link('formula-fantasy-1.firebaseapp.com')), /not a staging reset link/);
  assert.throws(() => oobCodeFromResetLink(link('formula-fantasy-staging.firebaseapp.com', 'verifyEmail')), /not a staging reset link/);
  assert.throws(() => oobCodeFromResetLink('https://formula-fantasy-staging.firebaseapp.com/__/auth/action?mode=resetPassword'), /no oobCode/);
});

const error = (message: string) => ({ error: { code: 400, message } });

test('sign-in classification: success is true, a wrong password is false', () => {
  assert.equal(classifySignIn(200, { idToken: 'x' }), true);
  assert.equal(classifySignIn(400, error('INVALID_LOGIN_CREDENTIALS')), false);
  assert.equal(classifySignIn(400, error('INVALID_PASSWORD')), false);
});

test('sign-in classification: a throttle or an outage throws with the code only', () => {
  assert.throws(
    () => classifySignIn(400, error('TOO_MANY_ATTEMPTS_TRY_LATER : Access to this account has been temporarily disabled.')),
    (e: Error) => e.message === 'signInWithPassword: HTTP 400 TOO_MANY_ATTEMPTS_TRY_LATER',
  );
  assert.throws(() => classifySignIn(500, { error: { message: 'BACKEND_ERROR' } }), /^Error: signInWithPassword: HTTP 500 BACKEND_ERROR$/);
  assert.throws(() => classifySignIn(500, null), (e: Error) => e.message === 'signInWithPassword: HTTP 500');
  // A 401 is not a wrong-password answer either, even with the credentials code.
  assert.throws(() => classifySignIn(401, error('INVALID_LOGIN_CREDENTIALS')), /HTTP 401/);
});
