import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeFields, decodeFields } from './firestore-value.ts';

test('round-trips the shapes the app stores', () => {
  const when = new Date('2026-11-26T18:00:00.000Z');
  const input = { s: 'x', i: 3, d: 1.5, b: true, n: null, t: when, a: ['p', 2], m: { gp: 0, nested: { ok: false } } };
  const encoded = encodeFields(input);
  assert.deepEqual(encoded.i, { integerValue: '3' });
  assert.deepEqual(encoded.d, { doubleValue: 1.5 });
  assert.deepEqual(encoded.t, { timestampValue: '2026-11-26T18:00:00.000Z' });
  assert.deepEqual(decodeFields(encoded), { ...input, t: '2026-11-26T18:00:00.000Z' });
});

test('decodeFields tolerates undefined', () => {
  assert.deepEqual(decodeFields(undefined), {});
});
