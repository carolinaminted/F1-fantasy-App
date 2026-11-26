import { test, expect } from '../fixtures.ts';

// Chromium logs each route-aborted request as this console error; it is the observed text, with no URL in it.
const ABORTED_REQUEST_LOG = /^console\.error: Failed to load resource: net::ERR_BLOCKED_BY_CLIENT\.Inspector$/;

test.describe('read-only mode', () => {
  test.use({ readOnly: true });

  test('Firestore writes and callables are aborted and recorded', async ({ memberPage, blocked, expectError }) => {
    expectError(ABORTED_REQUEST_LOG);
    await memberPage.goto('/');
    const results = await memberPage.evaluate(async () => {
      const attempt = (url: string) => fetch(url, { method: 'POST', body: '{}' }).then(() => 'sent', () => 'aborted');
      return Promise.all([
        attempt('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&database=projects%2Fformula-fantasy-staging%2Fdatabases%2F(default)'),
        attempt('https://us-central1-formula-fantasy-staging.cloudfunctions.net/submitPicks'),
      ]);
    });
    expect(results).toEqual(['aborted', 'aborted']);
    expect(blocked.some((b) => b.startsWith('WRITE') && b.includes('/Write/channel'))).toBe(true);
    expect(blocked.some((b) => b.startsWith('WRITE') && b.includes('submitPicks'))).toBe(true);
  });
});

test('requests naming a production project are aborted', async ({ memberPage, blocked, expectError, expectBlocked }) => {
  expectError(ABORTED_REQUEST_LOG);
  expectBlocked(/^FORBIDDEN https:\/\/firestore\.googleapis\.com\/v1\/projects\/formula-fantasy-1\/databases\/\(default\)\/documents\/users$/);
  await memberPage.goto('/');
  const result = await memberPage.evaluate(() =>
    fetch('https://firestore.googleapis.com/v1/projects/formula-fantasy-1/databases/(default)/documents/users').then(() => 'sent', () => 'aborted'));
  expect(result).toBe('aborted');
  expect(blocked.some((b) => b.includes('formula-fantasy-1'))).toBe(true);
});
