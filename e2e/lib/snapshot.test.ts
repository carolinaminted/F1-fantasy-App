import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical, memberDocPaths, restorePlan } from './snapshot.ts';

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
