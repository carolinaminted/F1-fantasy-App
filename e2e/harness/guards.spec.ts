import { test, expect } from '../fixtures.ts';
import { ABORTED_REQUEST_LOG } from '../lib/capture-noise.ts';
import { firestoreOutage } from '../lib/firestore-outage.ts';

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

// .invalid never resolves, so even with the guard missing this cannot reach a real host.
const PROD_LOOKALIKE = 'https://formula-fantasy-1.invalid/probe';

test('page.request and context.request are refused, so nothing skips the request guard', async ({ memberPage, page, context }) => {
  for (const api of [memberPage.request, memberPage.context().request, page.request, context.request]) {
    await expect(api.get(PROD_LOOKALIKE)).rejects.toThrow(/e2e guard/);
    await expect(api.fetch(PROD_LOOKALIKE, { method: 'POST' })).rejects.toThrow(/e2e guard/);
  }
});

test('after a Firestore outage ends, requests still go through the guard', async ({ memberPage, blocked, expectError }) => {
  expectError(/^console\.error: /);
  // No rule matches this collection and the fetch carries no token, so it cannot write even unguarded.
  const probe = 'https://firestore.googleapis.com/v1/projects/formula-fantasy-staging/databases/(default)/documents/e2e_probe/x';
  const outage = await firestoreOutage(memberPage);
  await memberPage.goto('/');
  outage.restore();
  const result = await memberPage.evaluate((url) => fetch(url, { method: 'PATCH', body: '{}' }).then(() => 'sent', () => 'aborted'), probe);
  expect(result).toBe('aborted');
  expect(blocked.some((b) => b.startsWith('WRITE PATCH') && b.includes('e2e_probe'))).toBe(true);
});

test.describe('observing writes', () => {
  test.use({ observeWrites: true });

  test('a Write channel message that carries a write is still aborted', async ({ memberPage, blocked, expectError }) => {
    expectError(ABORTED_REQUEST_LOG);
    await memberPage.goto('/');
    const result = await memberPage.evaluate(() => {
      const message = { writes: [{ delete: 'projects/formula-fantasy-staging/databases/(default)/documents/e2e_probe/x' }] };
      const body = new URLSearchParams({ count: '1', ofs: '1', req0___data__: JSON.stringify(message) });
      return fetch('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?e2e=probe', { method: 'POST', body })
        .then(() => 'sent', () => 'aborted');
    });
    expect(result).toBe('aborted');
    expect(blocked.some((b) => b.includes('e2e=probe'))).toBe(true);
  });
});
