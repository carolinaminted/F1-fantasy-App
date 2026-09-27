import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUsageRollup, calculateScoreRollup } from './scoringService.ts';
import { toScoredEventIds, parseSeasonConfig, parseSeasonCalendar } from './seasonConfig.ts';
import { EntityClass } from '../types.ts';

const pick = { aTeams: ['mcl', null], bTeam: 'hass', aDrivers: ['nor', null, null], bDrivers: ['oco', null, null], fastestLap: 'nor' } as any;
const system = { grandPrixFinish: [25, 18], sprintFinish: [8], fastestLap: 3, gpQualifying: [3], sprintQualifying: [3] } as any;
const results = { a_26: { grandPrixFinish: ['nor', 'oco'], fastestLap: 'nor' }, old_25: { grandPrixFinish: ['nor'] } } as any;
const drivers = [{ id: 'nor', constructorId: 'mcl' }, { id: 'oco', constructorId: 'hass' }] as any;

test('only events in the scored set count toward the score', () => {
  const picks = { a_26: pick, old_25: pick };
  const scored = calculateScoreRollup(picks, results, system, drivers, toScoredEventIds(['a_26']));
  const both = calculateScoreRollup(picks, results, system, drivers, toScoredEventIds(['a_26', 'old_25']));
  assert.ok(scored.totalPoints > 0);
  assert.ok(both.totalPoints > scored.totalPoints);
});

test('an empty scored set scores nothing', () => {
  assert.equal(calculateScoreRollup({ a_26: pick }, results, system, drivers, toScoredEventIds([])).totalPoints, 0);
});

test('usage only counts scored events', () => {
  const usage = calculateUsageRollup({ a_26: pick, old_25: pick }, toScoredEventIds(['a_26']));
  assert.equal(usage.drivers.nor[EntityClass.A], 1);
});

test('parseSeasonConfig returns ids, season id and label, and rejects anything incomplete', () => {
  const parsed = parseSeasonConfig({ activeSeasonId: '2026', label: '2026 Season', status: 'active', scoredEventIds: ['a_26'] })!;
  assert.deepEqual([...parsed.scoredEventIds], ['a_26']);
  assert.equal(parsed.seasonId, '2026');
  assert.equal(parsed.label, '2026 Season');
  assert.equal(parsed.status, 'active');
  assert.deepEqual(parsed.champions, []);
  assert.deepEqual(parseSeasonConfig({ activeSeasonId: '2026', label: 'x', status: 'concluded', champions: ['u1', 7], scoredEventIds: ['a_26'] })!.champions, ['u1']);
  assert.equal(parseSeasonConfig({ activeSeasonId: '2026', label: 'x', status: 'paused', scoredEventIds: ['a_26'] }), null);
  assert.equal(parseSeasonConfig({ activeSeasonId: '2026', label: 'x', scoredEventIds: ['a_26'] }), null);
  assert.equal(parseSeasonConfig(undefined), null);
  assert.equal(parseSeasonConfig({ activeSeasonId: '2026', label: '2026 Season', scoredEventIds: [] }), null);
  assert.equal(parseSeasonConfig({ activeSeasonId: '2026', scoredEventIds: ['a_26'] }), null);
  assert.equal(parseSeasonConfig({ label: 'x', scoredEventIds: ['a_26'] }), null);
});

test('parseSeasonCalendar restores the Event shape in round order and rejects bad input', () => {
  const ev = (id: string, round: number) => ({ id, round, name: 'N', country: 'C', location: 'L', circuit: 'K', hasSprint: false });
  const events = parseSeasonCalendar({ seasonId: '2026', events: [ev('b_26', 2), ev('a_26', 1)] })!;
  assert.deepEqual(events.map((e) => e.id), ['a_26', 'b_26']);
  assert.equal(events[0].lockAtUtc, '');
  assert.equal(events[0].softDeadlineUtc, '');
  assert.equal(parseSeasonCalendar(undefined), null);
  assert.equal(parseSeasonCalendar({ events: [] }), null);
  assert.equal(parseSeasonCalendar({ events: [{ id: 'a_26' }] }), null);
});
