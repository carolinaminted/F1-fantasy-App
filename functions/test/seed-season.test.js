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
