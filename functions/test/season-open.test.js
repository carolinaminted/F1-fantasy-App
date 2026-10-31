const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeFirestore } = require('./helpers/fake-firestore');
const { openSeason } = require('../season-ops/open');

const FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
const seed = (over = {}) => ({
  'season_config/current': { activeSeasonId: '2027', label: '2027 Season', status: 'setup', scoredEventIds: [] },
  'app_state/season_calendar': { seasonId: '2027', events: [{ id: 'b_27', round: 2 }, { id: 'a_27', round: 1 }] },
  'app_state/maintenance': { enabled: true, message: 'setting up' },
  ...over,
});

test('opens the season with its calendar as the scored events and turns maintenance off', async () => {
  const db = fakeFirestore(seed());
  const result = await openSeason(db, { seasonId: '2027', FieldValue });
  assert.deepEqual(result.scoredEventIds, ['a_27', 'b_27']);
  const config = db.docs.get('season_config/current');
  assert.equal(config.status, 'active');
  assert.deepEqual(config.scoredEventIds, ['a_27', 'b_27']);
  assert.deepEqual(db.docs.get('app_state/maintenance'), { enabled: false, message: 'setting up' });
  assert.equal(db.docs.get('season_ops/2027').open.state, 'done');
});

test('refuses, writing nothing, outside setup or without the new season calendar', async () => {
  const cases = [
    [{ 'season_config/current': { activeSeasonId: '2027', label: 'x', status: 'active', scoredEventIds: ['a_27'] } }, /status is active/],
    [{ 'app_state/season_calendar': { seasonId: '2026', events: [{ id: 'a_26', round: 1 }] } }, /calendar is for 2026/],
    [{ 'app_state/season_calendar': { seasonId: '2027', events: [] } }, /calendar has no events/],
  ];
  for (const [over, message] of cases) {
    const db = fakeFirestore(seed(over));
    const before = JSON.stringify([...db.docs]);
    await assert.rejects(openSeason(db, { seasonId: '2027', FieldValue }), message);
    assert.equal(JSON.stringify([...db.docs]), before);
  }
  await assert.rejects(openSeason(fakeFirestore(seed()), { seasonId: '2028', FieldValue }), /active season is 2027/);
});
