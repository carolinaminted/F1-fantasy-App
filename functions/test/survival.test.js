const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSurvivalStandings, eventsInPlay } = require('../survival');

const ORDER = ['e1', 'e2', 'e3', 'e4'];
const active = (entrants, startEventId = 'e1') => ({ status: 'active', startEventId, entrants });
const gp = (...ids) => ({ grandPrixFinish: ids });
const pick = (driverId) => ({ driverId });
const run = (over) => computeSurvivalStandings({
  config: active(['a', 'b', 'c']), picksByUser: {}, results: {}, cancelled: {}, eventOrder: ORDER, ...over,
});

test('returns null unless the challenge is active', () => {
  assert.equal(run({ config: null }), null);
  assert.equal(run({ config: { status: 'setup', startEventId: 'e1', entrants: ['a'] } }), null);
});

test('eventsInPlay starts at the start event and skips cancelled rounds', () => {
  assert.deepEqual(eventsInPlay(ORDER, 'e2', { e3: {} }), ['e2', 'e4']);
  assert.deepEqual(eventsInPlay(ORDER, 'nope', {}), []);
});

test('no results yet: everyone alive, nothing processed', () => {
  const s = run({});
  assert.equal(s.status, 'active');
  assert.equal(s.lastProcessedEventId, null);
  assert.equal(s.finalEventId, 'e4');
  assert.ok(['a', 'b', 'c'].every((u) => s.players[u].alive));
});

test('podium survives, off-podium and missed are eliminated', () => {
  const s = run({
    picksByUser: { a: { e1: pick('ver') }, b: { e1: pick('ham') } },
    results: { e1: gp('nor', 'pia', 'ver', 'ham') },
  });
  assert.equal(s.players.a.alive, true);
  assert.deepEqual(s.players.a.rounds.e1, { driverId: 'ver', position: 3, outcome: 'survived' });
  assert.equal(s.players.b.alive, false);
  assert.equal(s.players.b.reason, 'off-podium');
  assert.deepEqual(s.players.b.rounds.e1, { driverId: 'ham', position: 4, outcome: 'eliminated' });
  assert.equal(s.players.c.reason, 'missed');
  assert.equal(s.players.c.eliminatedAt, 'e1');
  // a is the last one standing
  assert.equal(s.status, 'complete');
  assert.deepEqual(s.winners, ['a']);
  assert.equal(s.decidedAt, 'e1');
});

test('processing stops at the first round without results', () => {
  const s = run({
    picksByUser: { a: { e1: pick('nor') }, b: { e1: pick('pia') }, c: { e1: pick('ver') } },
    results: { e1: gp('nor', 'pia', 'ver'), e3: gp('nor', 'pia', 'ver') },
  });
  assert.equal(s.lastProcessedEventId, 'e1');
  assert.equal(s.status, 'active');
  assert.equal(s.players.a.rounds.e3, undefined);
});

test('a cancelled round is skipped: nobody eliminated, no use spent', () => {
  const s = run({
    cancelled: { e1: { cancelledAt: 1 } },
    picksByUser: { a: { e1: pick('ham'), e2: pick('nor') }, b: { e2: pick('pia') }, c: { e2: pick('ver') } },
    results: { e1: gp('nor', 'pia', 'ver'), e2: gp('nor', 'pia', 'ver') },
  });
  assert.equal(s.players.a.alive, true);
  assert.equal(s.players.a.rounds.e1, undefined);
  assert.deepEqual(s.players.a.usage, { nor: 1 });
});

test('mass elimination in a non-final round ends with no winner', () => {
  const s = run({
    picksByUser: { a: { e1: pick('ham') }, b: { e1: pick('lec') }, c: { e1: pick('alo') } },
    results: { e1: gp('nor', 'pia', 'ver') },
  });
  assert.equal(s.status, 'complete');
  assert.deepEqual(s.winners, []);
  assert.equal(s.decidedAt, 'e1');
});

test('a fourth pick of the same driver counts as a missed pick', () => {
  const picks = { e1: pick('nor'), e2: pick('nor'), e3: pick('nor'), e4: pick('nor') };
  const s = computeSurvivalStandings({
    config: active(['a', 'b']),
    picksByUser: { a: picks, b: { e1: pick('pia'), e2: pick('pia'), e3: pick('ver'), e4: pick('pia') } },
    results: { e1: gp('nor', 'pia', 'ver'), e2: gp('nor', 'pia', 'ver'), e3: gp('nor', 'pia', 'ver'), e4: gp('nor', 'pia', 'ver') },
    cancelled: {}, eventOrder: ['e1', 'e2', 'e3', 'e4', 'e5'],
  });
  assert.equal(s.players.a.alive, false);
  assert.equal(s.players.a.reason, 'missed');
  assert.equal(s.players.a.rounds.e4.outcome, 'missed');
  assert.equal(s.players.a.usage.nor, 3);
  assert.deepEqual(s.winners, ['b']);
});

test('final round: highest finisher wins even off the podium', () => {
  const s = computeSurvivalStandings({
    config: active(['a', 'b', 'c']),
    picksByUser: { a: { e1: pick('ham') }, b: { e1: pick('lec') } },
    results: { e1: gp('nor', 'pia', 'ver', 'rus', 'ant', 'had', 'ham', 'lec') },
    cancelled: {}, eventOrder: ['e1'],
  });
  assert.equal(s.status, 'complete');
  assert.deepEqual(s.winners, ['a']);
  assert.equal(s.players.a.rounds.e1.outcome, 'won');
  assert.equal(s.players.a.alive, true);
  assert.equal(s.players.b.reason, 'final');
  assert.equal(s.players.b.alive, false);
  assert.equal(s.players.c.reason, 'missed');
});

test('final round: drivers outside the top 10, or the same driver, are co-winners', () => {
  const s = computeSurvivalStandings({
    config: active(['a', 'b', 'c']),
    picksByUser: { a: { e1: pick('str') }, b: { e1: pick('bot') }, c: { e1: pick('str') } },
    results: { e1: gp('nor', 'pia', 'ver') },
    cancelled: {}, eventOrder: ['e1'],
  });
  assert.deepEqual(s.winners.sort(), ['a', 'b', 'c']);
});

test('final round with no picks among the alive: no winner', () => {
  const s = computeSurvivalStandings({
    config: active(['a', 'b']), picksByUser: {}, results: { e1: gp('nor') }, cancelled: {}, eventOrder: ['e1'],
  });
  assert.equal(s.status, 'complete');
  assert.deepEqual(s.winners, []);
});

test('the final round is the last non-cancelled event', () => {
  const s = computeSurvivalStandings({
    config: active(['a', 'b']),
    picksByUser: { a: { e1: pick('ham') }, b: { e1: pick('lec') } },
    results: { e1: gp('nor', 'pia', 'ver', 'lec', 'ham') },
    cancelled: { e2: {} }, eventOrder: ['e1', 'e2'],
  });
  assert.equal(s.finalEventId, 'e1');
  assert.deepEqual(s.winners, ['b']);
});

test('picks from non-entrants are ignored', () => {
  const s = run({
    picksByUser: { a: { e1: pick('nor') }, b: { e1: pick('pia') }, c: { e1: pick('ver') }, z: { e1: pick('nor') } },
    results: { e1: gp('nor', 'pia', 'ver') },
  });
  assert.equal(s.players.z, undefined);
});

test('an empty challenge is complete with no winner', () => {
  const s = run({ config: active([]) });
  assert.equal(s.status, 'complete');
  assert.deepEqual(s.winners, []);
});

const { parseLeagueDate, resolveLockAt, validateSurvivalPick } = require('../survival');

test('parseLeagueDate: absolute strings pass through', () => {
  assert.equal(parseLeagueDate('2026-03-29T18:00:00Z').toISOString(), '2026-03-29T18:00:00.000Z');
  assert.equal(parseLeagueDate('2026-03-29T14:00:00-04:00').toISOString(), '2026-03-29T18:00:00.000Z');
});

test('parseLeagueDate: bare times are New York wall time across DST', () => {
  assert.equal(parseLeagueDate('2026-03-29T14:00').toISOString(), '2026-03-29T18:00:00.000Z'); // EDT
  assert.equal(parseLeagueDate('2026-01-10 14:00').toISOString(), '2026-01-10T19:00:00.000Z'); // EST
  assert.equal(parseLeagueDate(''), null);
  assert.equal(parseLeagueDate('garbage'), null);
});

test('resolveLockAt mirrors the client precedence', () => {
  const iso = (s) => resolveLockAt(s)?.toISOString() ?? null;
  assert.equal(iso({ qualifying: '2026-05-01T12:00:00Z', customLockAt: '2026-05-01T10:00:00Z' }), '2026-05-01T10:00:00.000Z');
  assert.equal(iso({ hasSprint: true, sprintQualifying: '2026-05-01T08:00:00Z', qualifying: '2026-05-02T12:00:00Z' }), '2026-05-01T08:00:00.000Z');
  assert.equal(iso({ hasSprint: false, sprintQualifying: '2026-05-01T08:00:00Z', qualifying: '2026-05-02T12:00:00Z' }), '2026-05-02T12:00:00.000Z');
  assert.equal(iso(null), null);
  assert.equal(iso({}), null);
});

const DRIVERS = [
  { id: 'nor', name: 'Lando Norris', isActive: true },
  { id: 'ham', name: 'Lewis Hamilton', isActive: true },
  { id: 'old', name: 'Retired Driver', isActive: false },
];
const base = (over = {}) => ({
  uid: 'a', eventId: 'e2', driverId: 'nor',
  config: { status: 'active', startEventId: 'e1', entrants: ['a', 'b'] },
  standings: { status: 'active', players: { a: { alive: true } } },
  picksDoc: {}, drivers: DRIVERS,
  schedule: { qualifying: '2026-05-02T12:00:00Z' },
  formLocked: false, cancelled: {},
  now: new Date('2026-05-01T00:00:00Z'),
  eventOrder: ['e1', 'e2', 'e3', 'e4', 'e5'],
  ...over,
});
const code = (over) => validateSurvivalPick(base(over)).code;

test('validateSurvivalPick accepts a good pick', () => {
  assert.deepEqual(validateSurvivalPick(base()), { ok: true });
  assert.deepEqual(validateSurvivalPick(base({ standings: null })), { ok: true }); // before the first recompute
});

test('validateSurvivalPick rejects each failure mode', () => {
  assert.equal(code({ config: null }), 'failed-precondition');
  assert.equal(code({ uid: 'z' }), 'permission-denied');
  assert.equal(code({ standings: { status: 'complete', players: {} } }), 'failed-precondition');
  assert.equal(code({ standings: { status: 'active', players: { a: { alive: false } } } }), 'failed-precondition');
  assert.equal(code({ eventId: 'e0' }), 'invalid-argument');
  assert.equal(code({ config: { status: 'active', startEventId: 'e3', entrants: ['a'] } }), 'invalid-argument');
  assert.equal(code({ cancelled: { e2: {} } }), 'failed-precondition');
  assert.equal(code({ schedule: null }), 'failed-precondition');
  assert.equal(code({ formLocked: true }), 'failed-precondition');
  assert.equal(code({ now: new Date('2026-05-02T12:00:00Z') }), 'failed-precondition');
  assert.equal(code({ driverId: 'xxx' }), 'invalid-argument');
  assert.equal(code({ driverId: 'old' }), 'invalid-argument');
  assert.equal(code({ drivers: [] }), 'failed-precondition');
});

test('validateSurvivalPick enforces the three-use budget, excluding the event being changed', () => {
  const three = { e1: { driverId: 'nor' }, e3: { driverId: 'nor' }, e4: { driverId: 'nor' } };
  const r = validateSurvivalPick(base({ picksDoc: three }));
  assert.equal(r.code, 'failed-precondition');
  assert.match(r.message, /Lando Norris/);
  // re-picking the same event does not double count
  assert.deepEqual(validateSurvivalPick(base({ picksDoc: { ...three, e2: { driverId: 'nor' }, e4: { driverId: 'ham' } } })), { ok: true });
  // picks on cancelled rounds do not count
  assert.deepEqual(validateSurvivalPick(base({ picksDoc: three, cancelled: { e4: {} } })), { ok: true });
});
