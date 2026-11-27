import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oobCodeFromResetLink } from './reset-link.ts';

const link = (host: string, mode = 'resetPassword') => `https://${host}/__/auth/action?mode=${mode}&oobCode=ABC123&apiKey=k&lang=en`;

test('takes the oobCode from a staging reset link', () => {
  assert.equal(oobCodeFromResetLink(link('formula-fantasy-staging.firebaseapp.com')), 'ABC123');
});

test('refuses a link for another project, another mode or no code', () => {
  assert.throws(() => oobCodeFromResetLink(link('formula-fantasy-1.firebaseapp.com')), /not a staging reset link/);
  assert.throws(() => oobCodeFromResetLink(link('formula-fantasy-staging.firebaseapp.com', 'verifyEmail')), /not a staging reset link/);
  assert.throws(() => oobCodeFromResetLink('https://formula-fantasy-staging.firebaseapp.com/__/auth/action?mode=resetPassword'), /no oobCode/);
});
