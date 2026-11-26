import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropBlockedWriteNoise, stripQuery } from './capture-noise.ts';

const ABORT = 'console.error: Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector';
const WRITE = 'WRITE POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8&gsessionid=x';

test('drops aborted-request lines when a write was blocked', () => {
  assert.deepEqual(dropBlockedWriteNoise([ABORT, ABORT], [WRITE]), { remaining: [], dropped: 2 });
});

test('keeps everything when no write was blocked', () => {
  assert.deepEqual(dropBlockedWriteNoise([ABORT], ['FORBIDDEN https://x/formula-fantasy-1']), { remaining: [ABORT], dropped: 0 });
});

test('never drops an unrelated error', () => {
  const other = 'pageerror: boom';
  assert.deepEqual(dropBlockedWriteNoise([other, ABORT], [WRITE]), { remaining: [other], dropped: 1 });
});

test('stripQuery removes the query string from a blocked entry', () => {
  assert.equal(stripQuery(WRITE), 'WRITE POST https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel');
});
