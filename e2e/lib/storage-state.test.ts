import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rebaseStorageState, type StorageState } from './storage-state.ts';

const state = (...origins: string[]): StorageState => ({
  cookies: [],
  origins: origins.map((origin) => ({ origin, localStorage: [{ name: 'k', value: origin }], indexedDB: [] })),
});

test('moves a single-origin state to the target origin', () => {
  const out = rebaseStorageState(state('http://127.0.0.1:3100'), 'http://127.0.0.1:3101');
  assert.equal(out.origins.length, 1);
  assert.equal(out.origins[0].origin, 'http://127.0.0.1:3101');
  assert.deepEqual(out.origins[0].localStorage, [{ name: 'k', value: 'http://127.0.0.1:3100' }]);
});

test('keeps only the matching origin when several are saved', () => {
  const out = rebaseStorageState(state('http://127.0.0.1:3100', 'http://127.0.0.1:3101'), 'http://127.0.0.1:3101');
  assert.deepEqual(out.origins.map((o) => o.origin), ['http://127.0.0.1:3101']);
  assert.equal(out.origins[0].localStorage[0].value, 'http://127.0.0.1:3101');
});

test('refuses several origins when none matches', () => {
  assert.throws(() => rebaseStorageState(state('http://a:1', 'http://b:2'), 'http://c:3'), /2 origins and none is http:\/\/c:3/);
});

test('leaves a state with no origins alone', () => {
  const empty = state();
  assert.equal(rebaseStorageState(empty, 'http://127.0.0.1:3101'), empty);
});
