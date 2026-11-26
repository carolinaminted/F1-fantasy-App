import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSixDigitCode, extractResetLink } from './mail.ts';

test('pulls the 6-digit code out of the verification email', () => {
  const text = 'Lights Out League\n        Your verification code is:\n        482913\n        This code expires in 10 minutes.';
  assert.equal(extractSixDigitCode(text), '482913');
  assert.equal(extractSixDigitCode('no code here 12345'), null);
});

test('ignores decoy digits and CSS colours around the code in the HTML template', () => {
  const html = '<html><body><p style="color:#333333">Ref 123456</p><div>Lights Out League</div>'
    + '<p>Your verification code is:</p><div style="font-size:32px">\n  <b>482913</b>\n</div>'
    + '<p style="color:#666666">This code expires in 10 minutes.</p></body></html>';
  assert.equal(extractSixDigitCode(html), '482913');
});

test('returns null for a 6-digit run without the verification phrase', () => {
  assert.equal(extractSixDigitCode('Order 123456 shipped'), null);
});

test('pulls the Firebase reset link out of the reset email', () => {
  const html = '<p>Reset</p><a href="https://formula-fantasy-staging.firebaseapp.com/__/auth/action?mode=resetPassword&amp;oobCode=abc123&amp;apiKey=k&amp;lang=en" style="x">Reset</a>';
  assert.equal(extractResetLink(html), 'https://formula-fantasy-staging.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=abc123&apiKey=k&lang=en');
  assert.equal(extractResetLink('<a href="https://example.com">x</a>'), null);
});
