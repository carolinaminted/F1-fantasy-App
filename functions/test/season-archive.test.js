const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeFirestore } = require('./helpers/fake-firestore');
const { archiveSeason } = require('../season-ops/archive');

const FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
const seed = (status = 'concluded') => ({
  'season_config/current': { activeSeasonId: '2026', label: '2026 Season', status, scoredEventIds: ['a_26'] },
  'app_state/race_results': { a_26: { grandPrixFinish: ['nor'] } },
  'app_state/maintenance': { enabled: false },
  'userPicks/u1': { a_26: { aTeams: ['mcl'], bTeam: 'hass', aDrivers: ['nor'], bDrivers: [] } },
  'userPicks/u2': { a_26: { aTeams: ['fer'], bTeam: 'sau', aDrivers: ['lec'], bDrivers: [] } },
  'public_users/u1': { displayName: 'Uno', totalPoints: 25, rank: 1 },
  'public_users/u2': { displayName: 'Dos', totalPoints: 10, rank: 2 },
});

test('archives, verifies, writes meta and career stats, and marks the season archived', async () => {
  const db = fakeFirestore(seed());
  const before = new Map([...db.docs].filter(([p]) => !p.startsWith('season_config/')));
  const result = await archiveSeason(db, { seasonId: '2026', FieldValue });
  assert.equal(result.ok, true);
  assert.deepEqual(db.docs.get('season_archives/2026/picks/u1'), seed()['userPicks/u1']);
  assert.equal(db.docs.get('season_archives/2026/standings/u1').finalRank, 1);
  assert.deepEqual(db.docs.get('season_archives/2026').champions, ['u1']);
  assert.equal(db.docs.get('career_stats/u1').championships, 1);
  assert.equal(db.docs.get('season_config/current').status, 'archived');
  assert.equal(db.docs.get('season_ops/2026').archive.state, 'verified');
  // Live data is untouched.
  before.forEach((data, path) => assert.deepEqual(db.docs.get(path), data, path));
});

test('refuses unless the season is concluded (or archived, for a re-run), writing nothing', async () => {
  const db = fakeFirestore(seed('active'));
  const size = db.docs.size;
  await assert.rejects(archiveSeason(db, { seasonId: '2026', FieldValue }), /status is active/);
  assert.equal(db.docs.size, size);
  await assert.rejects(archiveSeason(fakeFirestore(seed()), { seasonId: '2027', FieldValue }), /active season is 2026/);
});

test('re-running is idempotent and removes archive docs no longer in the plan', async () => {
  const db = fakeFirestore(seed());
  await archiveSeason(db, { seasonId: '2026', FieldValue });
  db.docs.delete('userPicks/u2');
  db.docs.delete('public_users/u2');
  const again = await archiveSeason(db, { seasonId: '2026', FieldValue });
  assert.equal(again.ok, true);
  assert.equal(db.docs.has('season_archives/2026/picks/u2'), false);
  assert.equal(db.docs.has('season_archives/2026/standings/u2'), false);
});

test('a verify failure is recorded and the status stays concluded', async () => {
  const db = fakeFirestore(seed());
  const realBulk = db.bulkWriter;
  // Corrupt one write on its way in.
  db.bulkWriter = () => {
    const w = realBulk();
    return { ...w, set: (ref, data) => w.set(ref, ref.path.endsWith('/picks/u1') ? { corrupted: true } : data) };
  };
  const result = await archiveSeason(db, { seasonId: '2026', FieldValue });
  assert.equal(result.ok, false);
  assert.deepEqual(result.mismatches, ['differs: season_archives/2026/picks/u1']);
  assert.equal(db.docs.get('season_config/current').status, 'concluded');
  assert.equal(db.docs.get('season_ops/2026').archive.state, 'failed');
  assert.equal(db.docs.has('season_archives/2026'), false);
});
