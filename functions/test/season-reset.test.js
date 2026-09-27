const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeFirestore } = require('./helpers/fake-firestore');
const { resetSeason } = require('../season-ops/reset');

const FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
const ZERO = { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 };
const seed = (over = {}) => ({
  'season_config/current': { activeSeasonId: '2026', label: '2026 Season', status: 'archived', scoredEventIds: ['a_26'] },
  'season_archives/2026': { seasonId: '2026' },
  'season_ops/2026': { archive: { state: 'verified', finishedAt: 1000 }, backup: { state: 'done', at: 2000 } },
  'app_state/maintenance': { enabled: false },
  'app_state/race_results': { a_26: { grandPrixFinish: ['nor'] } },
  'app_state/form_locks': { a_26: true },
  'app_state/cancelled_events': { events: { b_26: {} } },
  'app_state/entities': { drivers: [] },
  'userPicks/u1': { a_26: { aTeams: ['mcl'] } },
  'userPicks/u2': { a_26: { aTeams: ['fer'] } },
  'public_users/u1': { displayName: 'Uno', totalPoints: 90, rank: 1, breakdown: { gp: 90 } },
  'users/u1': { duesPaidStatus: 'Paid' },
  'users/u2': { duesPaidStatus: 'Paid' },
  ...over,
});

const expectResetState = (db) => {
  const config = db.docs.get('season_config/current');
  assert.deepEqual(config, { activeSeasonId: '2027', label: '2027 Season', status: 'setup', scoredEventIds: [] });
  assert.equal(db.docs.get('app_state/maintenance').enabled, true);
  assert.deepEqual(db.docs.get('public_users/u1'), { displayName: 'Uno', totalPoints: 0, rank: 999, breakdown: ZERO });
  assert.deepEqual(db.docs.get('app_state/race_results'), {});
  assert.deepEqual(db.docs.get('app_state/form_locks'), {});
  assert.deepEqual(db.docs.get('app_state/cancelled_events'), { events: {} });
  assert.equal([...db.docs.keys()].some((p) => p.startsWith('userPicks/')), false);
  assert.equal(db.docs.get('users/u1').duesPaidStatus, 'Unpaid');
  assert.equal(db.docs.get('users/u2').duesPaidStatus, 'Unpaid');
  assert.deepEqual(db.docs.get('app_state/entities'), { drivers: [] });
  assert.deepEqual(db.docs.get('season_archives/2026'), { seasonId: '2026' });
  assert.equal(db.docs.get('season_ops/2026').reset.state, 'done');
};

test('resets an archived season into setup for the next one', async () => {
  const db = fakeFirestore(seed());
  const result = await resetSeason(db, { seasonId: '2026', FieldValue });
  assert.equal(result.nextSeasonId, '2027');
  expectResetState(db);
});

test('writes in order: maintenance first, cancellations after the other clears, config last', async () => {
  const db = fakeFirestore(seed());
  const order = [];
  const realDoc = db.doc;
  db.doc = (path) => {
    const ref = realDoc(path);
    return { ...ref, set: (...a) => { order.push(path); return ref.set(...a); }, update: (...a) => { order.push(path); return ref.update(...a); } };
  };
  const realBulk = db.bulkWriter;
  db.bulkWriter = () => {
    const w = realBulk();
    return { ...w, set: (ref, d) => { order.push(ref.path); w.set(ref, d); }, delete: (ref) => { order.push(ref.path); w.delete(ref); } };
  };
  await resetSeason(db, { seasonId: '2026', FieldValue });
  const at = (p) => order.indexOf(p);
  assert.equal(order[0], 'app_state/maintenance');
  const cancelled = at('app_state/cancelled_events');
  ['app_state/race_results', 'app_state/form_locks', 'userPicks/u1', 'userPicks/u2', 'public_users/u1']
    .forEach((p) => assert.ok(at(p) < cancelled, p));
  assert.equal(order[order.length - 2], 'season_config/current');
  assert.equal(order[order.length - 1], 'season_ops/2026');
});

test('refuses, writing nothing, unless archived, verified and backed up after the archive', async () => {
  const cases = [
    [{ 'season_config/current': { activeSeasonId: '2026', label: 'x', status: 'concluded', scoredEventIds: ['a_26'] } }, /status is concluded/],
    [{ 'season_ops/2026': { archive: { state: 'failed', finishedAt: 1000 }, backup: { state: 'done', at: 2000 } } }, /archive has not been verified/],
    [{ 'season_ops/2026': { archive: { state: 'verified', finishedAt: 1000 } } }, /no completed backup/],
    [{ 'season_ops/2026': { archive: { state: 'verified', finishedAt: 1000 }, backup: { state: 'done', at: 500 } } }, /backup is older than the archive/],
  ];
  for (const [over, message] of cases) {
    const db = fakeFirestore(seed(over));
    const before = JSON.stringify([...db.docs]);
    await assert.rejects(resetSeason(db, { seasonId: '2026', FieldValue }), message);
    assert.equal(JSON.stringify([...db.docs]), before);
  }
  await assert.rejects(resetSeason(fakeFirestore(seed()), { seasonId: '2025', FieldValue }), /active season is 2026/);
  await assert.rejects(resetSeason(fakeFirestore(seed({ 'season_config/current': { activeSeasonId: 'test', label: 'x', status: 'archived', scoredEventIds: ['a'] } })), { seasonId: 'test', FieldValue }), /not a season year/);
});

test('a crashed run is simply re-run to the same end state', async () => {
  const db = fakeFirestore(seed());
  await db.doc('app_state/maintenance').set({ enabled: true, message: 'x' });
  await db.doc('public_users/u1').set({ displayName: 'Uno', totalPoints: 0, rank: 999, breakdown: ZERO });
  db.docs.delete('userPicks/u1');
  await resetSeason(db, { seasonId: '2026', FieldValue });
  expectResetState(db);
});
