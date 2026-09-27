import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateUsageRollup, calculateScoreRollup } from './scoringService.ts';
import { toScoredEventIds, parseSeasonConfig, NO_SCORED_EVENTS } from './seasonConfig.ts';
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
  assert.equal(calculateScoreRollup({ a_26: pick }, results, system, drivers, NO_SCORED_EVENTS).totalPoints, 0);
});

test('usage only counts scored events', () => {
  const usage = calculateUsageRollup({ a_26: pick, old_25: pick }, toScoredEventIds(['a_26']));
  assert.equal(usage.drivers.nor[EntityClass.A], 1);
});

test('parseSeasonConfig accepts a valid list and rejects anything else', () => {
  assert.deepEqual([...parseSeasonConfig({ scoredEventIds: ['a_26'] })!], ['a_26']);
  assert.equal(parseSeasonConfig(undefined), null);
  assert.equal(parseSeasonConfig({ scoredEventIds: [] }), null);
  assert.equal(parseSeasonConfig({ scoredEventIds: ['a_26', 7] }), null);
});
