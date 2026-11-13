import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeTrends } from './pickTrends.ts';
import type { Event, PickSelection, PickTrends } from '../types.ts';

const ev = (id: string, lock: string) => ({ id, lockAtUtc: lock }) as Event;
const EVENTS = [ev('r3', '2027-04-10T02:00'), ev('r1', '2027-03-12T10:30'), ev('r2', '2027-03-20T13:00'), ev('next', '2027-05-01T10:00')];
const DRIVERS = [{ id: 'nor', name: 'Norris' }, { id: 'ver', name: 'Verstappen' }, { id: 'lec', name: 'Leclerc' }];

const TRENDS: PickTrends = {
  events: {
    r1: { teams: {}, drivers: { nor: 3, ver: 1, gone: 9 } },
    r2: { teams: {}, drivers: { ver: 4 } },
    r3: { teams: {}, drivers: { lec: 2, nor: 1 } },
  },
};

const pick = (drivers: string[]) => ({ aTeams: [], bTeam: null, aDrivers: drivers, bDrivers: [], fastestLap: null }) as PickSelection;

test('counts the whole season, ranked, ignoring entities no longer listed', () => {
  const s = summarizeTrends(TRENDS, null, EVENTS, DRIVERS, 'drivers', null);
  assert.deepEqual(s.ranked.map(r => [r.entity.id, r.count]), [['ver', 5], ['nor', 4], ['lec', 2]]);
  assert.equal(s.picksCounted, 11);
  assert.equal(s.eventsCounted, 3);
});

test('a window counts only the most recent events by lock time, not by list order', () => {
  const s = summarizeTrends(TRENDS, null, EVENTS, DRIVERS, 'drivers', 2);
  assert.deepEqual(s.ranked.map(r => [r.entity.id, r.count]), [['ver', 4], ['lec', 2], ['nor', 1]]);
  assert.equal(s.eventsCounted, 2);
});

test('an event without trends (no results yet) is never counted, even with own picks on it', () => {
  const s = summarizeTrends(TRENDS, { next: pick(['lec']) }, EVENTS, DRIVERS, 'drivers', null);
  assert.equal(s.eventsCounted, 3);
  assert.equal(s.yourAlignment, null);
});

test('alignment is the share of own picks on the top third, over the same window', () => {
  // Season top third of three drivers is ver alone.
  assert.equal(summarizeTrends(TRENDS, { r1: pick(['ver', 'nor']), r2: pick(['ver']) }, EVENTS, DRIVERS, 'drivers', null).yourAlignment, 67);
  assert.equal(summarizeTrends(TRENDS, { r1: pick(['lec']) }, EVENTS, DRIVERS, 'drivers', 2).yourAlignment, null);
});

test('no trends yet gives an empty, zeroed summary', () => {
  const s = summarizeTrends({ events: {} }, null, EVENTS, DRIVERS, 'drivers', null);
  assert.equal(s.eventsCounted, 0);
  assert.equal(s.picksCounted, 0);
});
