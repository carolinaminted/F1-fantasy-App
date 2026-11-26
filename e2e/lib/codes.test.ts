import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isFreshVerification } from './codes.ts';

test('a verification doc is fresh only if issued after the journey started', () => {
  const startedAt = 1_000_000;
  // sendAuthCode writes expiresAt = issue time + 600000
  assert.equal(isFreshVerification({ code: '123456', expiresAt: startedAt + 600_000 + 50 }, startedAt), true);
  assert.equal(isFreshVerification({ code: '123456', expiresAt: startedAt + 600_000 - 60_000 }, startedAt), false);
  assert.equal(isFreshVerification(null, startedAt), false);
  assert.equal(isFreshVerification({ expiresAt: startedAt + 700_000 }, startedAt), false);
});
