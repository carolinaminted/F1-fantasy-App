import { test } from 'node:test';
import assert from 'node:assert/strict';
import { docUrl, fieldPath, patchUrl, patchDoc } from './staging-admin.ts';

test('every document URL is pinned to the staging project', () => {
  assert.equal(
    docUrl('users/abc'),
    'https://firestore.googleapis.com/v1/projects/formula-fantasy-staging/databases/(default)/documents/users/abc',
  );
});

test('paths cannot smuggle another project', () => {
  assert.throws(() => docUrl('../../../projects/formula-fantasy-1/databases/(default)/documents/users/x'));
  assert.throws(() => docUrl('users/../x'));
});
