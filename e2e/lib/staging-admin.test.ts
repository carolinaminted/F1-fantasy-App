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

test('fieldPath leaves simple identifiers bare', () => {
  assert.equal(fieldPath('isAdmin'), 'isAdmin');
});

test('fieldPath backtick-quotes keys that are not plain identifiers', () => {
  assert.equal(fieldPath('a-b'), '`a-b`');
  assert.equal(fieldPath('a.b'), '`a.b`');
  assert.equal(fieldPath('1abc'), '`1abc`');
});

test('fieldPath escapes backticks and backslashes inside quoted keys', () => {
  assert.equal(fieldPath('a`b'), '`a\\`b`');
  assert.equal(fieldPath('a\\b'), '`a\\\\b`');
});

test('patchUrl emits one encoded updateMask per key and keeps the docUrl path', () => {
  const url = patchUrl('users/x', ['isAdmin', 'gp-1']);
  const [base, query] = url.split('?');
  assert.equal(base, docUrl('users/x'));
  const masks = query.split('&');
  assert.equal(masks.length, 2);
  assert.ok(masks.every((m) => m.startsWith('updateMask.fieldPaths=')));
  assert.equal(masks[0], 'updateMask.fieldPaths=isAdmin');
  assert.equal(masks[1], 'updateMask.fieldPaths=%60gp-1%60');
});

test('patchDoc rejects an empty patch before any token or network work', async () => {
  await assert.rejects(() => patchDoc('users/x', {}), /no fields given/);
});
