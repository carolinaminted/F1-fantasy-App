const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeFirestore } = require('./helpers/fake-firestore');
const { concludeSeason, hasAnyResult } = require('../season-ops/conclude');

const FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
const seed = (overrides = {}) => ({
  'season_config/current': { activeSeasonId: '2026', label: '2026 Season', status: 'active', scoredEventIds: ['a_26', 'b_26', 'c_26'] },
  'app_state/race_results': {
    a_26: { grandPrixFinish: ['nor'] },
    // The scaffold an admin leaves by opening the results form and saving nothing.
    b_26: { grandPrixFinish: [null, null], fastestLap: null },
  },
  'app_state/cancelled_events': { events: { c_26: { at: 'x' } } },
  'public_users/u1': { displayName: 'Uno', totalPoints: 90 },
  'public_users/u2': { displayName: 'Dos', totalPoints: 90 },
  'public_users/u3': { displayName: 'Tres', totalPoints: 50 },
  ...overrides,
});
const allSettled = { 'app_state/race_results': { a_26: { grandPrixFinish: ['nor'] }, b_26: { fastestLap: 'lec' } } };

test('hasAnyResult ignores an empty scaffold', () => {
  assert.equal(hasAnyResult({ grandPrixFinish: [null, null], fastestLap: null }), false);
  assert.equal(hasAnyResult({ grandPrixFinish: [null, 'nor'] }), true);
  assert.equal(hasAnyResult(undefined), false);
});

test('refuses while any scored event has neither a result nor a cancellation', async () => {
  const db = fakeFirestore(seed());
  await assert.rejects(concludeSeason(db, { seasonId: '2026', FieldValue }), /cannot conclude: no results for b_26/);
  assert.equal(db.docs.get('season_config/current').status, 'active');
});

test('concludes: co-champions on equal points, podium, status and ops record', async () => {
  const db = fakeFirestore(seed(allSettled));
  const result = await concludeSeason(db, { seasonId: '2026', FieldValue });
  assert.deepEqual(result, { champions: ['u2', 'u1'], podium: ['u2', 'u1', 'u3'] });
  const config = db.docs.get('season_config/current');
  assert.equal(config.status, 'concluded');
  assert.deepEqual(config.champions, ['u2', 'u1']);
  assert.deepEqual(config.finalPodium, [
    { uid: 'u2', displayName: 'Dos', totalPoints: 90, finalRank: 1 },
    { uid: 'u1', displayName: 'Uno', totalPoints: 90, finalRank: 1 },
    { uid: 'u3', displayName: 'Tres', totalPoints: 50, finalRank: 3 },
  ]);
  assert.deepEqual(config.scoredEventIds, ['a_26', 'b_26', 'c_26']);
  assert.equal(db.docs.get('season_ops/2026').conclude.state, 'done');
});

test('refuses a season that is not active, or not the active one', async () => {
  const concluded = fakeFirestore(seed({ ...allSettled, 'season_config/current': { activeSeasonId: '2026', label: 'x', status: 'concluded', scoredEventIds: ['a_26'] } }));
  await assert.rejects(concludeSeason(concluded, { seasonId: '2026', FieldValue }), /cannot conclude: status is concluded/);
  await assert.rejects(concludeSeason(fakeFirestore(seed(allSettled)), { seasonId: '2027', FieldValue }), /cannot conclude: active season is 2026/);
});
