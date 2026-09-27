const test = require('node:test');
const assert = require('node:assert/strict');
const { planArchive, diffArchive, computeCareerStats, APP_STATE_POLICY } = require('../season-ops/archive-plan');

const live = () => ({
  seasonConfig: { activeSeasonId: '2026', label: '2026 Season', status: 'concluded', scoredEventIds: ['a_26'] },
  appState: {
    race_results: { a_26: { grandPrixFinish: ['nor'] } },
    event_schedules: {}, form_locks: {}, cancelled_events: {}, scoring_config: {}, entities: {}, season_calendar: {},
    maintenance: { enabled: false }, league_config: {}, general_announcement: {}, results_announcement: {},
  },
  // The slot array is the only record of a pick's class, so it must survive byte-for-byte.
  picks: { u1: { a_26: { aTeams: ['mcl', null], bTeam: 'hass', aDrivers: ['nor'], bDrivers: [] } } },
  publicUsers: { u1: { displayName: 'Uno', totalPoints: 25, rank: 1, breakdown: { gp: 25 } } },
});

test('archives season-scoped app_state verbatim and skips league-wide docs', () => {
  const { writes } = planArchive(live(), '2026');
  const paths = writes.map((w) => w.path);
  APP_STATE_POLICY.archive.forEach((id) => assert.ok(paths.includes(`season_archives/2026/state/${id}`), id));
  APP_STATE_POLICY.skip.forEach((id) => assert.ok(!paths.includes(`season_archives/2026/state/${id}`), id));
  assert.ok(paths.includes('season_archives/2026/state/season_config'));
  assert.deepEqual(writes.find((w) => w.path.endsWith('/state/race_results')).data, live().appState.race_results);
});

test('copies picks verbatim and standings with finalRank', () => {
  const { writes } = planArchive(live(), '2026');
  assert.deepEqual(writes.find((w) => w.path === 'season_archives/2026/picks/u1').data, live().picks.u1);
  assert.deepEqual(writes.find((w) => w.path === 'season_archives/2026/standings/u1').data,
    { ...live().publicUsers.u1, finalRank: 1 });
});

test('meta names the champion and podium and records counts', () => {
  const { meta } = planArchive(live(), '2026');
  assert.deepEqual(meta.champions, ['u1']);
  assert.deepEqual(meta.counts, { state: 8, picks: 1, standings: 1 });
  assert.deepEqual(meta.scoredEventIds, ['a_26']);
  assert.deepEqual(meta.finalPodium, [{ uid: 'u1', displayName: 'Uno', totalPoints: 25, finalRank: 1 }]);
});

test('refuses an unclassified app_state document', () => {
  const l = live();
  l.appState.mystery = {};
  assert.throws(() => planArchive(l, '2026'), /unclassified app_state document: mystery/);
});

test('diffArchive reports missing, extra and differing documents', () => {
  const writes = [{ path: 'p/a', data: { x: 1 } }, { path: 'p/b', data: { y: [1, 2] } }];
  assert.deepEqual(diffArchive(writes, { 'p/a': { x: 1 }, 'p/b': { y: [1, 2] } }), []);
  const d = diffArchive(writes, { 'p/a': { x: 2 }, 'p/c': {} });
  assert.deepEqual(d.sort(), ['differs: p/a', 'extra: p/c', 'missing: p/b']);
});

test('career stats aggregate across seasons; a title is not also a podium', () => {
  const stats = computeCareerStats([
    { seasonId: '2026', standings: [{ uid: 'u1', finalRank: 1, totalPoints: 300 }, { uid: 'u2', finalRank: 3, totalPoints: 200 }] },
    { seasonId: '2027', standings: [{ uid: 'u1', finalRank: 4, totalPoints: 150 }] },
  ]);
  assert.deepEqual(stats.u1, {
    seasonsPlayed: 2, championships: 1, podiums: 0, bestFinish: 1, totalPoints: 450,
    seasons: { 2026: { finalRank: 1, totalPoints: 300 }, 2027: { finalRank: 4, totalPoints: 150 } },
  });
  assert.equal(stats.u2.podiums, 1);
  assert.equal(stats.u2.championships, 0);
});
