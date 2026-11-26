import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitKnownIssues, isFirestoreWriteBody } from './known-issues.ts';

const text = 'pageerror: Missing or insufficient permissions.';
const seed = '{"writes":[{"update":{"name":"projects/p/databases/(default)/documents/app_state/race_results"}}]}';
const e = (pageId: string, t = text) => ({ text: t, pageId });
const writes = (o: Record<string, string[]>) => new Map(Object.entries(o));

test('allows the permission pageerror only with a race_results write from the same page', () => {
  assert.deepEqual(splitKnownIssues([e('a')], writes({ a: [seed] })), { remaining: [], knownHit: true });
  assert.deepEqual(splitKnownIssues([e('a')], writes({})), { remaining: [e('a')], knownHit: false });
  assert.deepEqual(splitKnownIssues([e('a')], writes({ a: ['{"documents/users/abc"}'] })), { remaining: [e('a')], knownHit: false });
});

test("another page's race_results write does not excuse this page's error", () => {
  const r = splitKnownIssues([e('member')], writes({ admin: [seed] }));
  assert.deepEqual(r, { remaining: [e('member')], knownHit: false });
  const both = splitKnownIssues([e('member'), e('admin')], writes({ admin: [seed] }));
  assert.deepEqual(both.remaining, [e('member')]);
});

test('matches a form-encoded document path', () => {
  assert.equal(splitKnownIssues([e('a')], writes({ a: ['writes=documents%2Fapp_state%2Frace_results'] })).knownHit, true);
});

test('does not allow other errors or loose matches', () => {
  const other = ['pageerror: boom', 'console.error: Missing or insufficient permissions.', `${text} extra`].map((t) => e('a', t));
  assert.deepEqual(splitKnownIssues(other, writes({ a: [seed] })), { remaining: other, knownHit: false });
});

test('recognises Firestore write channel and commit URLs', () => {
  assert.equal(isFirestoreWriteBody('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?x=1'), true);
  assert.equal(isFirestoreWriteBody('https://firestore.googleapis.com/v1/projects/p/databases/(default)/documents:commit'), true);
  assert.equal(isFirestoreWriteBody('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel'), false);
});
