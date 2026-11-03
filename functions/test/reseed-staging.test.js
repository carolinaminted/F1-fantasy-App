const test = require('node:test');
const assert = require('node:assert/strict');
const { fakeFirestore } = require('./helpers/fake-firestore');
const { planReseed } = require('../scripts/reseed-staging');

const archivedConfig = {
  activeSeasonId: '2026', label: '2026 Season', status: 'concluded', scoredEventIds: ['aus_26', 'bhr_26'],
  champions: ['u1'], podium: { first: ['u1'] }, finalPodium: [{ uid: 'u1' }], concludedAt: 'ts',
};
const calendar2026 = { seasonId: '2026', events: [{ id: 'aus_26', round: 1 }, { id: 'bhr_26', round: 2 }] };
const results2026 = { aus_26: { gp: ['VER'] }, bhr_26: { gp: ['NOR'] } };
const archive = {
  'season_archives/2026': { seasonId: '2026', label: '2026 Season' },
  'season_archives/2026/state/season_config': archivedConfig,
  'season_archives/2026/state/race_results': results2026,
  'season_archives/2026/state/season_calendar': calendar2026,
  'season_archives/2026/state/cancelled_events': { events: { sau_26: { reason: 'war' } } },
  'season_archives/2026/state/form_locks': { aus_26: true },
  'season_archives/2026/picks/u1': { aus_26: { drivers: ['VER'] } },
  'season_archives/2026/standings/u1': { displayName: 'A', totalPoints: 1344, rank: 1, finalRank: 1 },
  'season_archives/2026/standings/u2': { displayName: 'B', totalPoints: 0, rank: 2, finalRank: 2 },
};
const rolledOver = {
  'app_state/staging_seed_metadata': { seededAt: 'x' },
  'season_config/current': { activeSeasonId: '2027', label: '2027 Season', status: 'active', scoredEventIds: ['bhr_27'] },
  'app_state/season_calendar': { seasonId: '2027', events: [{ id: 'bhr_27', round: 1 }] },
  'app_state/race_results': {},
  'app_state/cancelled_events': { events: {} },
  'app_state/form_locks': {},
  'app_state/maintenance': { enabled: false },
  'userPicks/u2': { bhr_27: { drivers: ['PIA'] } },
  'public_users/u1': { displayName: 'A', totalPoints: 0, rank: 999 },
  'public_users/u2': { displayName: 'B', totalPoints: 0, rank: 999 },
  'season_ops/2026': { conclude: {}, archive: {}, backup: {}, reset: {} },
  'season_ops/2027': { open: {} },
  'career_stats/u1': { seasonsPlayed: 1 },
};
const apply = async (plan) => { for (const p of plan) await p.write(); };

test('restores 2026 as an active season from its archive and undoes the rollover', async () => {
  const db = fakeFirestore({ ...archive, ...rolledOver });
  const plan = await planReseed(db, { seasonId: '2026' });
  await apply(plan);
  assert.deepEqual(db.docs.get('season_config/current'), {
    activeSeasonId: '2026', label: '2026 Season', status: 'active', scoredEventIds: ['aus_26', 'bhr_26'],
  }, 'active, with the conclusion fields removed');
  assert.deepEqual(db.docs.get('app_state/season_calendar'), calendar2026);
  assert.deepEqual(db.docs.get('app_state/race_results'), results2026);
  assert.deepEqual(db.docs.get('app_state/cancelled_events'), { events: { sau_26: { reason: 'war' } } });
  assert.deepEqual(db.docs.get('app_state/form_locks'), { aus_26: true });
  assert.deepEqual(db.docs.get('userPicks/u1'), { aus_26: { drivers: ['VER'] } });
  assert.equal(db.docs.has('userPicks/u2'), false, 'the 2027 pick is gone');
  assert.deepEqual(db.docs.get('public_users/u1'), { displayName: 'A', totalPoints: 1344, rank: 1 }, 'finalRank dropped');
  assert.equal(db.docs.has('season_ops/2026'), false);
  assert.equal(db.docs.has('season_ops/2027'), false);
});

test('leaves the archive, career stats, maintenance and the staging marker alone', async () => {
  const db = fakeFirestore({ ...archive, ...rolledOver });
  await apply(await planReseed(db, { seasonId: '2026' }));
  Object.entries(archive).forEach(([p, d]) => assert.deepEqual(db.docs.get(p), d, p));
  assert.deepEqual(db.docs.get('career_stats/u1'), { seasonsPlayed: 1 });
  assert.deepEqual(db.docs.get('app_state/maintenance'), { enabled: false });
  assert.ok(db.docs.has('app_state/staging_seed_metadata'));
});

test('the config write is the last step', async () => {
  const plan = await planReseed(fakeFirestore({ ...archive, ...rolledOver }), { seasonId: '2026' });
  assert.equal(plan.at(-1).path, 'season_config/current');
});

test('refuses without the staging marker, without the archive, or when no rollover from that season happened', async () => {
  const without = (key) => Object.fromEntries(Object.entries({ ...archive, ...rolledOver }).filter(([p]) => !p.startsWith(key)));
  await assert.rejects(planReseed(fakeFirestore(without('app_state/staging_seed_metadata')), { seasonId: '2026' }), /not the staging seed/);
  await assert.rejects(planReseed(fakeFirestore(without('season_archives/2026')), { seasonId: '2026' }), /season_archives\/2026 is missing/);
  await assert.rejects(planReseed(fakeFirestore({ ...archive, ...rolledOver }), { seasonId: '2025' }), /active season is 2027, not 2026/);
  await assert.rejects(planReseed(fakeFirestore({ ...archive, ...rolledOver }), { seasonId: 'abc' }), /not a season year/);
  const incomplete = without('season_archives/2026/state/race_results');
  await assert.rejects(planReseed(fakeFirestore(incomplete), { seasonId: '2026' }), /no state\/race_results/);
});
