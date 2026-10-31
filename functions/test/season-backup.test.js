const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeFirestore } = require('./helpers/fake-firestore');
const { backupLeague } = require('../season-ops/backup');

const FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
const now = () => new Date('2027-01-10T15:30:00.000Z');
const seed = (over = {}) => ({
  'season_config/current': { activeSeasonId: '2026', label: '2026 Season', status: 'archived', scoredEventIds: ['a_26'] },
  'season_ops/2026': { archive: { state: 'verified', finishedAt: 1000 } },
  ...over,
});
const fakeExporter = () => {
  const calls = [];
  const exportDocuments = async (request) => {
    calls.push(request);
    return { name: 'projects/p/databases/(default)/operations/op-1' };
  };
  return { calls, exportDocuments };
};
const options = (exportDocuments) => ({
  seasonId: '2026', FieldValue, exportDocuments, projectId: 'formula-fantasy-staging',
  bucket: 'formula-fantasy-staging-season-backups', now,
});

test('exports every collection to a season- and time-stamped prefix and records it', async () => {
  const db = fakeFirestore(seed());
  const { calls, exportDocuments } = fakeExporter();
  const result = await backupLeague(db, options(exportDocuments));

  const outputUri = 'gs://formula-fantasy-staging-season-backups/season-2026/2027-01-10T15:30:00.000Z';
  assert.deepEqual(calls, [{
    name: 'projects/formula-fantasy-staging/databases/(default)', outputUriPrefix: outputUri, collectionIds: [],
  }]);
  assert.deepEqual(result, { outputUri });
  assert.deepEqual(db.docs.get('season_ops/2026').backup, {
    state: 'done', at: 'SERVER_TIME', outputUri, operation: 'projects/p/databases/(default)/operations/op-1',
  });
  assert.equal(db.docs.get('season_ops/2026').archive.state, 'verified');
});

test('records a failed export and passes the error on', async () => {
  const db = fakeFirestore(seed());
  const exportDocuments = async () => { throw new Error('PERMISSION_DENIED on bucket'); };
  await assert.rejects(backupLeague(db, options(exportDocuments)), /PERMISSION_DENIED/);
  const { backup } = db.docs.get('season_ops/2026');
  assert.equal(backup.state, 'failed');
  assert.equal(backup.error, 'PERMISSION_DENIED on bucket');
});

test('refuses unless the active season is archived with a verified archive', async () => {
  const cases = [
    [{ 'season_config/current': undefined }, /season_config\/current is missing/],
    [{ 'season_config/current': { activeSeasonId: '2027', status: 'archived' } }, /active season is 2027/],
    [{ 'season_config/current': { activeSeasonId: '2026', status: 'concluded' } }, /status is concluded/],
    [{ 'season_ops/2026': { archive: { state: 'failed' } } }, /archive has not been verified/],
  ];
  for (const [over, message] of cases) {
    const db = fakeFirestore(Object.fromEntries(Object.entries(seed(over)).filter(([, v]) => v !== undefined)));
    const { calls, exportDocuments } = fakeExporter();
    await assert.rejects(backupLeague(db, options(exportDocuments)), message);
    assert.equal(calls.length, 0);
  }
});

test('refuses when this project has no backup bucket', async () => {
  const { calls, exportDocuments } = fakeExporter();
  await assert.rejects(
    backupLeague(fakeFirestore(seed()), { ...options(exportDocuments), bucket: null }),
    /no backup bucket/,
  );
  assert.equal(calls.length, 0);
});

test('a backup taken after the archive satisfies the start-season check', async () => {
  const { resetSeason } = require('../season-ops/reset');
  const db = fakeFirestore(seed({ 'season_archives/2026': { seasonId: '2026' }, 'public_users/u1': { totalPoints: 1 }, 'users/u1': {} }));
  await backupLeague(db, { ...options(fakeExporter().exportDocuments), FieldValue: { serverTimestamp: () => 2000 } });
  await assert.doesNotReject(resetSeason(db, { seasonId: '2026', FieldValue }));
});
