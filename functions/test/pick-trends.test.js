const test = require('node:test');
const assert = require('node:assert/strict');
const { countPickTrends } = require('../pick-trends');

const lineup = (over = {}) => ({
  aTeams: ['mcl', 'fer'], bTeam: 'has', aDrivers: ['nor', 'lec', null], bDrivers: ['oco', null, null], fastestLap: 'nor', ...over,
});
const ran = { grandPrixFinish: ['nor'] };

test('counts every slot of every member, per event', () => {
  const { events } = countPickTrends(
    { u1: { a: lineup() }, u2: { a: lineup({ aTeams: ['mcl', 'rbr'], aDrivers: ['nor', 'ver', null] }) } },
    { a: ran }, new Set(['a']), new Set(),
  );
  assert.deepEqual(events.a.teams, { mcl: 2, fer: 1, rbr: 1, has: 2 });
  assert.deepEqual(events.a.drivers, { nor: 2, lec: 1, ver: 1, oco: 2 });
});

test('an event without results is not counted, so its picks stay private until it runs', () => {
  const { events } = countPickTrends({ u1: { a: lineup(), next: lineup() } }, { a: ran }, new Set(['a', 'next']), new Set());
  assert.deepEqual(Object.keys(events), ['a']);
});

test('unscored and cancelled events are not counted', () => {
  const { events } = countPickTrends(
    { u1: { a: lineup(), old: lineup(), can: lineup() } },
    { a: ran, old: ran, can: ran }, new Set(['a', 'can']), new Set(['can']),
  );
  assert.deepEqual(Object.keys(events), ['a']);
});

test('no picks gives no events', () => {
  assert.deepEqual(countPickTrends({}, { a: ran }, new Set(['a']), new Set()), { events: {} });
});
