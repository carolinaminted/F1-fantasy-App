import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitKnownIssues, isFirestoreWriteBody } from './known-issues.ts';

const err = 'pageerror: Missing or insufficient permissions.';
const seed = '{"writes":[{"update":{"name":"projects/p/databases/(default)/documents/app_state/race_results"}}]}';

test('allows the permission pageerror only with a race_results write', () => {
  assert.deepEqual(splitKnownIssues([err], [seed]), { remaining: [], knownHit: true });
  assert.deepEqual(splitKnownIssues([err], []), { remaining: [err], knownHit: false });
  assert.deepEqual(splitKnownIssues([err], ['{"documents/users/abc"}']), { remaining: [err], knownHit: false });
});

test('matches a form-encoded document path', () => {
  assert.equal(splitKnownIssues([err], ['writes=documents%2Fapp_state%2Frace_results']).knownHit, true);
});

test('does not allow other errors or loose matches', () => {
  const other = ['pageerror: boom', 'console.error: Missing or insufficient permissions.', `${err} extra`];
  assert.deepEqual(splitKnownIssues(other, [seed]), { remaining: other, knownHit: false });
});

test('recognises Firestore write channel and commit URLs', () => {
  assert.equal(isFirestoreWriteBody('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?x=1'), true);
  assert.equal(isFirestoreWriteBody('https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents:commit'), true);
  assert.equal(isFirestoreWriteBody('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel'), false);
});
