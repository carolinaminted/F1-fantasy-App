import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical, changedPaths, memberDocPaths, restoreDocs, restorePlan, snapshotDocs, type DocIo, type DocSnapshot } from './snapshot.ts';

test('a doc that did not exist is deleted on restore, one that did is put back whole', () => {
  const fields = { displayName: { stringValue: 'E2E Member' }, at: { timestampValue: '2026-11-26T10:00:00Z' } };
  assert.deepEqual(restorePlan([{ path: 'userPicks/u1', fields: null }, { path: 'users/u1', fields }]), [
    { path: 'userPicks/u1', action: 'delete' },
    { path: 'users/u1', action: 'put', fields },
  ]);
});

test('canonical ignores key order at every depth and keeps value types', () => {
  const a = { b: { stringValue: 'x' }, a: { mapValue: { fields: { z: { integerValue: '1' }, y: { nullValue: null } } } } };
  const b = { a: { mapValue: { fields: { y: { nullValue: null }, z: { integerValue: '1' } } } }, b: { stringValue: 'x' } };
  assert.equal(canonical(a), canonical(b));
  assert.notEqual(canonical({ n: { integerValue: '1' } }), canonical({ n: { doubleValue: 1 } }));
});

test('member doc paths cover everything member journeys write', () => {
  assert.deepEqual(memberDocPaths('u1'), ['users/u1', 'public_users/u1', 'userPicks/u1']);
});

const io = (over: Partial<DocIo>): DocIo => ({ get: async () => null, put: async () => {}, del: async () => {}, ...over });

test('restore attempts every document, then names only the failed paths', async () => {
  const attempted: string[] = [];
  const secret = 'SECRET-FIELD-VALUE';
  const stub = io({
    put: async (path) => { attempted.push(path); if (path === 'users/u1') throw new Error(`put ${path}: HTTP 500 ${secret}`); },
    del: async (path) => { attempted.push(path); },
  });
  const snaps = [
    { path: 'users/u1', fields: { n: { stringValue: secret } } },
    { path: 'userPicks/u1', fields: null },
    { path: 'public_users/u1', fields: { n: { stringValue: 'x' } } },
  ];
  await assert.rejects(restoreDocs(snaps, stub), (e: Error) => {
    assert.equal(e.message, 'restore failed for: users/u1');
    return true;
  });
  assert.deepEqual(attempted, ['users/u1', 'userPicks/u1', 'public_users/u1']);
});

test('restore resolves quietly when every step works', async () => {
  await restoreDocs([{ path: 'users/u1', fields: { a: { stringValue: 'a' } } }], io({}));
});

test('changedPaths names the documents that differ, ignoring key order and values', () => {
  const was: DocSnapshot[] = [
    { path: 'users/u1', fields: { a: { stringValue: '1' }, b: { stringValue: '2' } } },
    { path: 'userPicks/u1', fields: null },
    { path: 'public_users/u1', fields: { a: { stringValue: '1' } } },
  ];
  const now: DocSnapshot[] = [
    { path: 'users/u1', fields: { b:{ stringValue: '2' }, a: { stringValue: '1' } } },
    { path: 'userPicks/u1', fields: { x: { stringValue: 'created' } } },
    { path: 'public_users/u1', fields: { a: { stringValue: 'changed' } } },
  ];
  assert.deepEqual(changedPaths(was, now), ['userPicks/u1', 'public_users/u1']);
  assert.deepEqual(changedPaths(was, was), []);
});

test('changedPaths counts a document missing from the re-read as changed', () => {
  assert.deepEqual(changedPaths([{ path: 'users/u1', fields: null }], []), ['users/u1']);
});

test('snapshotDocs reads each path through the given io', async () => {
  const snaps = await snapshotDocs(['users/u1', 'userPicks/u1'], io({ get: async (p) => (p === 'users/u1' ? { a: { stringValue: 'a' } } : null) }));
  assert.deepEqual(snaps, [{ path: 'users/u1', fields: { a: { stringValue: 'a' } } }, { path: 'userPicks/u1', fields: null }]);
});
