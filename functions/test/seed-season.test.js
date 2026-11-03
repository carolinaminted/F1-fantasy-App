const test = require('node:test');
const assert = require('node:assert/strict');
const season2026 = require('../scripts/data/season-2026.json');
const { buildSeasonDocs } = require('../scripts/seed-season');

test('builds both documents for 2026 in round order', () => {
  const { config, calendar } = buildSeasonDocs(season2026);
  assert.deepEqual(
    { ...config, scoredEventIds: undefined },
    { activeSeasonId: '2026', label: '2026 Season', status: 'active', scoredEventIds: undefined },
  );
  assert.equal(config.scoredEventIds.length, 23);
  assert.deepEqual(config.scoredEventIds, calendar.events.map((e) => e.id));
  assert.equal(calendar.seasonId, '2026');
  assert.equal(calendar.events[0].id, 'aus_26');
  assert.equal(calendar.events[22].id, 'abu_26');
});

test('calendar events carry exactly the display fields', () => {
  const { calendar } = buildSeasonDocs(season2026);
  calendar.events.forEach((e) => assert.deepEqual(
    Object.keys(e).sort(),
    ['circuit', 'country', 'hasSprint', 'id', 'location', 'name', 'round'],
  ));
});

test('Bahrain is on the calendar and Saudi Arabia is not', () => {
  const ids = buildSeasonDocs(season2026).config.scoredEventIds;
  assert.ok(ids.includes('bhr_26'));
  assert.ok(!ids.includes('sau_26'));
});

test('refuses an empty, duplicated or out-of-order calendar', () => {
  const ev = (id, round) => ({ id, round, name: 'x', country: 'x', location: 'x', circuit: 'x', hasSprint: false });
  const base = { seasonId: '2027', label: '2027 Season' };
  assert.throws(() => buildSeasonDocs({ ...base, events: [] }), /events/);
  assert.throws(() => buildSeasonDocs({ ...base, events: [ev('a', 1), ev('a', 2)] }), /duplicate/);
  assert.throws(() => buildSeasonDocs({ ...base, events: [ev('a', 2), ev('b', 1)] }), /round/);
});

const { fakeFirestore } = require('./helpers/fake-firestore');
const { planSeed } = require('../scripts/seed-season');
const season2027 = require('../scripts/data/season-2027.json');
const docs2027 = buildSeasonDocs(season2027);
const setupConfig = { activeSeasonId: '2027', label: '2027 Season', status: 'setup', scoredEventIds: [] };
const staleCalendar = buildSeasonDocs(season2026).calendar;

test('create mode: creates both documents on a fresh project and nothing else', async () => {
  const db = fakeFirestore();
  const plan = await planSeed(db, docs2027, { calendarOnly: false });
  assert.deepEqual(plan.map((p) => [p.path, p.action]), [
    ['season_config/current', 'create'],
    ['app_state/season_calendar', 'create'],
  ]);
  for (const p of plan) await p.write();
  assert.deepEqual(db.docs.get('season_config/current'), docs2027.config);
  assert.deepEqual(db.docs.get('app_state/season_calendar'), docs2027.calendar);
});

test('create mode: still refuses when a document exists and differs', async () => {
  const db = fakeFirestore({ 'season_config/current': setupConfig, 'app_state/season_calendar': staleCalendar });
  await assert.rejects(planSeed(db, docs2027, { calendarOnly: false }), /season_config\/current already exists and differs/);
});

test('calendar-only: overwrites the stale calendar while the config is in setup for that season', async () => {
  const db = fakeFirestore({ 'season_config/current': setupConfig, 'app_state/season_calendar': staleCalendar });
  const plan = await planSeed(db, docs2027, { calendarOnly: true });
  assert.deepEqual(plan.map((p) => [p.path, p.action]), [['app_state/season_calendar', 'overwrite']]);
  for (const p of plan) await p.write();
  assert.deepEqual(db.docs.get('app_state/season_calendar'), docs2027.calendar);
  assert.deepEqual(db.docs.get('season_config/current'), setupConfig, 'the config is left alone');
});

test('calendar-only: creates the calendar when it is missing, and is a no-op when current', async () => {
  const db = fakeFirestore({ 'season_config/current': setupConfig });
  const plan = await planSeed(db, docs2027, { calendarOnly: true });
  assert.deepEqual(plan.map((p) => [p.path, p.action]), [['app_state/season_calendar', 'create']]);
  for (const p of plan) await p.write();
  assert.deepEqual(await planSeed(db, docs2027, { calendarOnly: true }), []);
});

test('calendar-only: refuses unless the config is in setup for exactly the requested season', async () => {
  const seasonMismatch = { ...setupConfig, activeSeasonId: '2026' };
  const active = { ...setupConfig, status: 'active' };
  for (const [config, why] of [[undefined, /missing/], [seasonMismatch, /2026, not 2027/], [active, /status is active/]]) {
    const db = fakeFirestore(config ? { 'season_config/current': config, 'app_state/season_calendar': staleCalendar } : {});
    await assert.rejects(planSeed(db, docs2027, { calendarOnly: true }), why);
    assert.deepEqual(db.docs.get('app_state/season_calendar'), config ? staleCalendar : undefined, 'nothing written');
  }
});
