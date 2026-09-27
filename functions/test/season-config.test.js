const test = require('node:test');
const assert = require('node:assert/strict');
const { parseScoredEventIds } = require('../season-config');

const snap = (data) => ({ exists: data !== undefined, data: () => data });

test('returns the scored event ids as a Set', () => {
  const ids = parseScoredEventIds(snap({ scoredEventIds: ['aus_26', 'chn_26'] }));
  assert.ok(ids instanceof Set);
  assert.deepEqual([...ids], ['aus_26', 'chn_26']);
});

test('refuses a missing document', () => {
  assert.throws(() => parseScoredEventIds(snap(undefined)), /^Error: season_config\/current/);
});

test('refuses a missing or empty list', () => {
  assert.throws(() => parseScoredEventIds(snap({})), /season_config\/current/);
  assert.throws(() => parseScoredEventIds(snap({ scoredEventIds: [] })), /season_config\/current/);
  assert.throws(() => parseScoredEventIds(snap({ scoredEventIds: 'aus_26' })), /season_config\/current/);
});

test('refuses a list with a non-string or blank entry', () => {
  assert.throws(() => parseScoredEventIds(snap({ scoredEventIds: ['aus_26', 3] })), /season_config\/current/);
  assert.throws(() => parseScoredEventIds(snap({ scoredEventIds: ['aus_26', ''] })), /season_config\/current/);
});
