import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { calculateScoreRollup } from './scoringService.ts';
import { toScoredEventIds } from './seasonConfig.ts';
import type { Driver, EventResult, PickSelection, PointsSystem, RaceResults } from '../types.ts';

// The scoring engine is implemented twice: here for the client, and in functions/scoring.js for
// recalculateEntireLeague, whose output is what Standings shows. A rule change that lands in only
// one of them makes a member's own breakdown disagree with the league table.
const server = createRequire(import.meta.url)('../functions/scoring.js');

const TEAMS = ['mcl', 'fer', 'rbr', 'mer', 'ast', 'alp', 'wil', 'rb', 'sau', 'has', 'cad'];
const DRIVERS: Driver[] = TEAMS.flatMap((team, i) => [
  { id: `d${i * 2}`, constructorId: team },
  { id: `d${i * 2 + 1}`, constructorId: team },
] as Driver[]);
const DRIVER_IDS = DRIVERS.map(d => d.id);

const ACTIVE: PointsSystem = server.DEFAULT_POINTS;
const ALT: PointsSystem = {
  grandPrixFinish: [30, 20, 15, 12, 10, 8, 6, 4, 2, 1, 1, 1],
  sprintFinish: [10, 8, 6, 5, 4, 3, 2, 1],
  fastestLap: 5,
  gpQualifying: [5, 3, 1],
  sprintQualifying: [4, 2],
};

/** Server engine, shaped like the client rollup. The server folds both qualifying sessions into one `quali`. */
const serverRollup = (
  picks: Record<string, PickSelection>, results: RaceResults, scored: string[], cancelled: string[] = [],
) => {
  const { totalPoints, breakdown } = server.scoreUserSeason(
    picks, results, ACTIVE, DRIVERS, toScoredEventIds(scored), new Set(cancelled));
  return { totalPoints, gp: breakdown.gp, sprint: breakdown.sprint, quali: breakdown.quali, fl: breakdown.fl, p22: breakdown.p22 };
};

const clientRollup = (
  picks: Record<string, PickSelection>, results: RaceResults, scored: string[], cancelled: string[] = [],
) => {
  const r = calculateScoreRollup(picks, results, ACTIVE, DRIVERS, toScoredEventIds(scored), new Set(cancelled));
  return {
    totalPoints: r.totalPoints, gp: r.grandPrixPoints, sprint: r.sprintPoints,
    quali: r.gpQualifyingPoints + r.sprintQualifyingPoints, fl: r.fastestLapPoints, p22: r.p22Count,
  };
};

const assertParity = (
  label: string, picks: Record<string, PickSelection>, results: RaceResults, scored: string[], cancelled: string[] = [],
) => {
  const client = clientRollup(picks, results, scored, cancelled);
  assert.deepEqual(client, serverRollup(picks, results, scored, cancelled), label);
  return client;
};

const pick = (p: Partial<PickSelection>): PickSelection => ({
  aTeams: [null, null], bTeam: null, aDrivers: [null, null, null], bDrivers: [null, null, null], fastestLap: null, ...p,
});

test('a sprint weekend scores identically in every category', () => {
  const results: RaceResults = {
    e1: {
      grandPrixFinish: ['d0', 'd2', 'd1', 'd4', 'd3'],
      sprintFinish: ['d2', 'd0', 'd1'],
      gpQualifying: ['d1', 'd0', 'd2'],
      sprintQualifying: ['d0', 'd2'],
      fastestLap: 'd2', p22Driver: 'd21',
    },
  };
  const picks = { e1: pick({ aTeams: ['mcl', 'fer'], bTeam: 'cad', aDrivers: ['d2', 'd4'], bDrivers: ['d21'], fastestLap: 'd2' }) };
  const r = assertParity('sprint weekend', picks, results, ['e1']);
  assert.ok(r.gp > 0 && r.sprint > 0 && r.quali > 0 && r.fl > 0 && r.p22 === 1);
});

test('the driver-team snapshot on a result outranks the current entity list for both engines', () => {
  // d0 drove for fer that weekend; today's list says mcl.
  const results: RaceResults = { e1: { grandPrixFinish: ['d0'], fastestLap: null, p22Driver: null, driverTeams: { d0: 'fer' } } };
  const r = assertParity('snapshot', { e1: pick({ aTeams: ['fer', null] }) }, results, ['e1']);
  assert.equal(r.gp, 25);
  assert.equal(assertParity('snapshot, old team', { e1: pick({ aTeams: ['mcl', null] }) }, results, ['e1']).gp, 0);
});

test('a scoring snapshot on a result outranks the active system for both engines', () => {
  const results: RaceResults = { e1: { grandPrixFinish: ['d0'], fastestLap: 'd0', p22Driver: null, scoringSnapshot: ALT } };
  const r = assertParity('scoring snapshot', { e1: pick({ aDrivers: ['d0', null, null], fastestLap: 'd0' }) }, results, ['e1']);
  assert.equal(r.totalPoints, 35);
});

test('penalties round up the deduction identically', () => {
  // GP P1 25 + P4 12 = 37; 20% is 7.4, deducted as 8.
  const results: RaceResults = { e1: { grandPrixFinish: ['d0', 'd2', 'd4', 'd1'], fastestLap: null, p22Driver: null } };
  const r = assertParity('penalty', { e1: pick({ aDrivers: ['d0', 'd1', null], penalty: 0.2 }) }, results, ['e1']);
  assert.equal(r.totalPoints, 29);
});

test('unscored, cancelled and resultless events score nothing in either engine', () => {
  const ev: EventResult = { grandPrixFinish: ['d0'], fastestLap: null, p22Driver: null };
  const p = pick({ aDrivers: ['d0', null, null] });
  const r = assertParity('filters', { e1: p, old: p, can: p, future: p }, { e1: ev, old: ev, can: ev }, ['e1', 'can', 'future'], ['can']);
  assert.equal(r.totalPoints, 25);
});

// --- Generated seasons -------------------------------------------------------------------------

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const buildSeason = (rand: () => number) => {
  const shuffle = <T,>(xs: T[]) => xs.map(x => [rand(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);
  const oneOf = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  // An unfilled position (a DNF-left-blank or a short field) is stored as null.
  const order = (n: number) => shuffle(DRIVER_IDS).slice(0, n).map(id => (rand() < 0.05 ? null : id));

  const eventIds = Array.from({ length: 24 }, (_, i) => `r${i}`);
  const results: RaceResults = {};
  eventIds.slice(0, 20).forEach(id => {
    const sprint = rand() < 0.3;
    const result: EventResult = {
      grandPrixFinish: order(22),
      gpQualifying: rand() < 0.9 ? order(22) : undefined,
      fastestLap: rand() < 0.9 ? oneOf(DRIVER_IDS) : null,
      p22Driver: rand() < 0.8 ? oneOf(DRIVER_IDS) : null,
    };
    if (sprint) {
      result.sprintFinish = order(22);
      result.sprintQualifying = order(22);
    }
    if (rand() < 0.4) {
      // A mid-season seat swap, recorded on the result.
      const [a, b] = shuffle(DRIVERS).slice(0, 2);
      result.driverTeams = Object.fromEntries(DRIVERS.map(d => [d.id, d.constructorId]));
      result.driverTeams[a.id] = b.constructorId;
      result.driverTeams[b.id] = a.constructorId;
    }
    if (rand() < 0.15) result.scoringSnapshot = ALT;
    results[id] = result;
  });

  const scored = eventIds.filter(() => rand() < 0.9);
  const cancelled = scored.filter(() => rand() < 0.08);

  const member = () => {
    const picks: Record<string, PickSelection> = {};
    eventIds.forEach(id => {
      if (rand() < 0.1) return;
      const teams = shuffle(TEAMS);
      const drivers = shuffle(DRIVER_IDS);
      const slot = (x: string) => (rand() < 0.1 ? null : x);
      picks[id] = {
        aTeams: [slot(teams[0]), slot(teams[1])],
        bTeam: slot(teams[2]),
        aDrivers: [slot(drivers[0]), slot(drivers[1]), slot(drivers[2])],
        bDrivers: [slot(drivers[3]), slot(drivers[4]), slot(drivers[5])],
        fastestLap: rand() < 0.9 ? oneOf(DRIVER_IDS) : null,
        ...(rand() < 0.08 ? { penalty: oneOf([0.1, 0.2, 0.25, 0.33, 0.5]) } : {}),
      };
    });
    return picks;
  };

  return { results, scored, cancelled, members: Array.from({ length: 40 }, member) };
};

test('generated seasons score identically per event and per member', () => {
  const totals = { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0, penalised: 0 };
  for (let seed = 1; seed <= 25; seed++) {
    const { results, scored, cancelled, members } = buildSeason(rng(seed));
    members.forEach((picks, m) => {
      Object.entries(picks).forEach(([eventId, p]) => {
        assertParity(`seed ${seed}, member ${m}, ${eventId}`, { [eventId]: p }, results, scored, cancelled);
        if (p.penalty && results[eventId] && scored.includes(eventId)) totals.penalised++;
      });
      const r = assertParity(`seed ${seed}, member ${m}, season`, picks, results, scored, cancelled);
      totals.gp += r.gp; totals.sprint += r.sprint; totals.quali += r.quali; totals.fl += r.fl; totals.p22 += r.p22;
    });
  }
  // Guard against a fixture that scores nothing, where 0 === 0 would pass vacuously.
  Object.entries(totals).forEach(([k, v]) => assert.ok(v > 0, `fixtures never exercised ${k}`));
});

test('the active points system resolves the same way recalculateEntireLeague always has', () => {
  const profiles = [{ id: 'std', name: 'Standard', config: ACTIVE }, { id: 'alt', name: 'Alt', config: ALT }];
  assert.equal(server.resolvePointsSystem(undefined), server.DEFAULT_POINTS);
  assert.equal(server.resolvePointsSystem({ activeProfileId: 'alt', profiles }), ALT);
  assert.equal(server.resolvePointsSystem({ activeProfileId: 'gone', profiles }), server.DEFAULT_POINTS);
  assert.equal(server.resolvePointsSystem({ profiles }), server.DEFAULT_POINTS);
  // A pre-profiles doc is the points system itself.
  assert.equal(server.resolvePointsSystem(ALT), ALT);
});
