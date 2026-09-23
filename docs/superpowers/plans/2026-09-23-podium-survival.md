# Podium Survival Challenge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone elimination game where entrants pick one driver per GP to finish on the podium, with server-authoritative pick validation and standings.

**Architecture:** A pure CommonJS engine (`functions/survival.js`) computes standings and validates picks. A callable (`submitSurvivalPick`) is the only writer of `survival_picks/{uid}`; a Firestore trigger (`updateSurvivalStandings`) recomputes `app_state/survival_standings` whenever results, cancellations or the challenge config change. The React client listens to config, standings and picks, and renders a `/survival` page plus an admin tool.

**Tech Stack:** Firebase Gen 2 Functions (firebase-functions v6, firebase-admin v12, `node --test`), React 19 + TypeScript + Vite 6, Tailwind v4 tokens.

**Spec:** `docs/superpowers/specs/2026-09-23-podium-survival-design.md`

## Global Constraints

- Work only on branch `feat/podium-survival`. Never merge to `staging`/`prod`, never deploy, never touch `formula-fantasy-1` or `lights-out-league-prod`.
- Podium = `grandPrixFinish` indices 0–2. Sprints never count.
- Max 3 picks per driver per user for the challenge.
- Calendar order is `SEASON_EVENT_IDS` from `functions/season-events.js`.
- All client Firestore access goes through `services/firestoreService.ts`.
- Commits: conventional + scoped (`feat(survival): …`), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use `LOL_SKIP_REFS_HINT=1` (the item has no short ID).
- Theming: token classes only (`text-pure-white`, `text-highlight-silver`, `bg-accent-gray/40`, `text-on-primary` on red fills). Headings `font-black uppercase italic`. Figures use `NUMERIC`.
- Verification commands: `cd functions && npm test`; `npm run lint`; `npm run build -- --mode staging`.

---

## File Structure

| File | Responsibility |
|---|---|
| `functions/survival.js` (create) | Pure engine: league-date parsing, lock resolution, standings computation, pick validation |
| `functions/test/survival.test.js` (create) | Engine + validator tests |
| `functions/test/season-events.test.js` (modify) | Pin calendar *order*, which the engine depends on |
| `functions/index.js` (modify) | `submitSurvivalPick` callable, `updateSurvivalStandings` trigger |
| `functions/portal-callables.json`, `deploy-staging.sh` (modify) | Register the new functions |
| `firestore.rules` (modify) | `survival_picks` read for signed-in, no client writes |
| `types.ts` (modify) | Survival types |
| `services/firestoreService.ts` (modify) | Listeners, config writes, callable wrapper, display names |
| `hooks/useSurvival.ts` (create) | One hook subscribing config, standings, picks, names |
| `utils/survival.ts` (create) | Client helpers: in-play events, current round, lock check |
| `components/icons/SurvivalIcon.tsx` (create) | Podium icon |
| `components/survival/SurvivalDriverSheet.tsx` (create) | Driver chooser with uses-left |
| `components/survival/SurvivalRoundCard.tsx` (create) | The member's own round state + pick |
| `components/survival/SurvivalBoard.tsx` (create) | Active / eliminated leaderboard |
| `components/survival/SurvivalEntryCard.tsx` (create) | Link card for League + Race |
| `components/SurvivalPage.tsx` (create) | `/survival` surface |
| `components/SurvivalAdminPage.tsx` (create) | Admin tool |
| `App.tsx`, `routes.ts`, `components/AdminPage.tsx`, `components/LeagueHubPage.tsx`, `components/RacePage.tsx` (modify) | Wiring |

---

### Task 1: Survival engine — standings

**Files:**
- Create: `functions/survival.js`
- Create: `functions/test/survival.test.js`
- Modify: `functions/test/season-events.test.js`

**Interfaces:**
- Produces: `computeSurvivalStandings({ config, picksByUser, results, cancelled, eventOrder }) → SurvivalStandings | null`, `eventsInPlay(eventOrder, startEventId, cancelled) → string[]`, constants `PODIUM_SIZE = 3`, `MAX_DRIVER_USES = 3`.
- `SurvivalStandings = { status: 'active'|'complete', winners: string[], decidedAt: string|null, lastProcessedEventId: string|null, finalEventId: string|null, players: { [uid]: { alive, eliminatedAt, reason: 'off-podium'|'missed'|'final'|null, usage: {[driverId]: number}, rounds: {[eventId]: { driverId: string|null, position: number|null, outcome: 'survived'|'eliminated'|'missed'|'won' }} } } }`
- `cancelled` is the `events` map of `app_state/cancelled_events` (`{ [eventId]: {...} }`).

- [ ] **Step 1: Write the failing tests**

`functions/test/survival.test.js`:

```js
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
```

Append to `functions/test/season-events.test.js`:

```js
test('keeps calendar order — the survival engine walks rounds in this order', () => {
  assert.deepEqual([...SEASON_EVENT_IDS], readConstantsEventIds());
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && npm test`
Expected: FAIL with `Cannot find module '../survival'` (the season-events order test passes already).

- [ ] **Step 3: Implement `functions/survival.js` (standings half)**

```js
/**
 * Podium Survival Challenge engine. Pure: no Firestore, no clock unless one is passed in.
 * See docs/superpowers/specs/2026-09-23-podium-survival-design.md for the rules.
 */

const PODIUM_SIZE = 3;
const MAX_DRIVER_USES = 3;

/** The challenge's rounds, in calendar order: from the start event on, cancelled ones dropped. */
const eventsInPlay = (eventOrder, startEventId, cancelled = {}) => {
  const start = eventOrder.indexOf(startEventId);
  if (start === -1) return [];
  return eventOrder.slice(start).filter((id) => !cancelled[id]);
};

const hasGpResult = (result) =>
  Array.isArray(result?.grandPrixFinish) && result.grandPrixFinish.some(Boolean);

/** 1-based finishing position, or null when the driver is outside the recorded P1–P10. */
const positionIn = (finish, driverId) => {
  const idx = finish.indexOf(driverId);
  return idx === -1 ? null : idx + 1;
};

const newPlayer = () => ({ alive: true, eliminatedAt: null, reason: null, usage: {}, rounds: {} });

const eliminate = (player, eventId, reason) => {
  player.alive = false;
  player.eliminatedAt = eventId;
  player.reason = reason;
};

const computeSurvivalStandings = ({ config, picksByUser = {}, results = {}, cancelled = {}, eventOrder }) => {
  if (!config || config.status !== 'active') return null;

  const entrants = Array.isArray(config.entrants) ? config.entrants : [];
  const rounds = eventsInPlay(eventOrder, config.startEventId, cancelled);
  const finalEventId = rounds.length ? rounds[rounds.length - 1] : null;

  const players = {};
  entrants.forEach((uid) => { players[uid] = newPlayer(); });

  const standings = {
    status: 'active', winners: [], decidedAt: null, lastProcessedEventId: null, finalEventId, players,
  };
  const finish = (eventId, winners) => {
    standings.status = 'complete';
    standings.winners = winners;
    standings.decidedAt = eventId;
    return standings;
  };

  if (entrants.length === 0) return finish(null, []);

  for (const eventId of rounds) {
    const result = results[eventId];
    if (!hasGpResult(result)) break;

    const order = result.grandPrixFinish;
    const isFinal = eventId === finalEventId;
    const alive = entrants.filter((uid) => players[uid].alive);
    const contenders = [];

    for (const uid of alive) {
      const player = players[uid];
      const driverId = picksByUser[uid]?.[eventId]?.driverId || null;
      const overBudget = driverId && (player.usage[driverId] || 0) >= MAX_DRIVER_USES;

      if (!driverId || overBudget) {
        player.rounds[eventId] = { driverId, position: null, outcome: 'missed' };
        eliminate(player, eventId, 'missed');
        continue;
      }

      player.usage[driverId] = (player.usage[driverId] || 0) + 1;
      const position = positionIn(order, driverId);

      if (isFinal) {
        player.rounds[eventId] = { driverId, position, outcome: 'eliminated' };
        contenders.push(uid);
      } else if (position !== null && position <= PODIUM_SIZE) {
        player.rounds[eventId] = { driverId, position, outcome: 'survived' };
      } else {
        player.rounds[eventId] = { driverId, position, outcome: 'eliminated' };
        eliminate(player, eventId, 'off-podium');
      }
    }

    standings.lastProcessedEventId = eventId;

    if (isFinal) {
      if (contenders.length === 0) return finish(eventId, []);
      const rank = (uid) => players[uid].rounds[eventId].position ?? Infinity;
      const best = Math.min(...contenders.map(rank));
      const winners = contenders.filter((uid) => rank(uid) === best);
      contenders.forEach((uid) => {
        if (winners.includes(uid)) players[uid].rounds[eventId].outcome = 'won';
        else eliminate(players[uid], eventId, 'final');
      });
      return finish(eventId, winners);
    }

    const survivors = alive.filter((uid) => players[uid].alive);
    if (survivors.length === 0) return finish(eventId, []);
    if (survivors.length === 1) return finish(eventId, survivors);
  }

  return standings;
};

module.exports = {
  PODIUM_SIZE,
  MAX_DRIVER_USES,
  eventsInPlay,
  computeSurvivalStandings,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && npm test`
Expected: all pass (42 existing + 15 new).

- [ ] **Step 5: Commit**

```bash
git add functions/survival.js functions/test/survival.test.js functions/test/season-events.test.js
LOL_SKIP_REFS_HINT=1 git commit -m "feat(survival): standings engine for the Podium Survival Challenge" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Survival engine — lock resolution and pick validation

**Files:**
- Modify: `functions/survival.js`
- Modify: `functions/test/survival.test.js`

**Interfaces:**
- Consumes: `eventsInPlay`, `MAX_DRIVER_USES` (Task 1).
- Produces:
  - `parseLeagueDate(value) → Date | null` — strings ending in `Z` or an offset are absolute; bare `YYYY-MM-DDTHH:mm[:ss]` is America/New_York wall time.
  - `resolveLockAt(schedule) → Date | null` — `customLockAt` → (`hasSprint !== false` ? `sprintQualifying || qualifying` : `qualifying`).
  - `validateSurvivalPick({ uid, eventId, driverId, config, standings, picksDoc, drivers, schedule, formLocked, cancelled, now, eventOrder }) → { ok: true } | { ok: false, code, message }` where `code` is an `HttpsError` code.

- [ ] **Step 1: Write the failing tests** (append to `functions/test/survival.test.js`)

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && npm test`
Expected: FAIL — `parseLeagueDate is not a function`.

- [ ] **Step 3: Implement** — insert into `functions/survival.js` above `module.exports`, and extend the exports:

```js
const LEAGUE_TIMEZONE = 'America/New_York';

/** How far New York wall-clock time is ahead of UTC at instant `ms` (negative: behind). */
const leagueOffsetMs = (ms) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LEAGUE_TIMEZONE, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - ms;
};

/**
 * Server twin of utils/dateUtils.ts `parseLeagueDate`. Admin-entered schedule times are bare
 * `datetime-local` strings meaning New York time; Cloud Functions run in UTC, so they cannot be
 * handed to `new Date()` as-is.
 */
const parseLeagueDate = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = trimmed.replace(' ', 'T').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  let instant = wall - leagueOffsetMs(wall);
  const corrected = wall - leagueOffsetMs(instant); // second pass settles DST boundaries
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
};

/**
 * The picks deadline, with the same precedence as App.tsx `mergedEvents`. The server has no copy
 * of constants.ts, so an event without an imported schedule resolves to null and the pick is refused.
 */
const resolveLockAt = (schedule) => {
  if (!schedule) return null;
  const raw = schedule.customLockAt
    || (schedule.hasSprint !== false ? (schedule.sprintQualifying || schedule.qualifying) : schedule.qualifying);
  return parseLeagueDate(raw);
};

const reject = (code, message) => ({ ok: false, code, message });

const validateSurvivalPick = ({
  uid, eventId, driverId, config, standings, picksDoc = {}, drivers = [], schedule,
  formLocked, cancelled = {}, now, eventOrder,
}) => {
  if (!config || config.status !== 'active') return reject('failed-precondition', 'The Survival Challenge is not running.');
  if (!(config.entrants || []).includes(uid)) return reject('permission-denied', 'You are not entered in this challenge.');
  if (standings?.status === 'complete') return reject('failed-precondition', 'The challenge is over.');
  if (standings?.players?.[uid]?.alive === false) return reject('failed-precondition', 'You have been eliminated.');

  const rounds = eventsInPlay(eventOrder, config.startEventId, {});
  if (!rounds.includes(eventId)) return reject('invalid-argument', 'That race is not part of the challenge.');
  if (cancelled[eventId]) return reject('failed-precondition', 'That race has been cancelled.');

  const lockAt = resolveLockAt(schedule);
  if (!lockAt) return reject('failed-precondition', 'That race has no lock time yet. Picks open once its schedule is set.');
  if (formLocked || now.getTime() >= lockAt.getTime()) return reject('failed-precondition', 'Picks for that race are locked.');

  if (!drivers.length) return reject('failed-precondition', 'The driver list is unavailable. Try again shortly.');
  const driver = drivers.find((d) => d.id === driverId && d.isActive !== false);
  if (!driver) return reject('invalid-argument', 'That driver is not available.');

  const uses = rounds.filter((id) => id !== eventId && !cancelled[id] && picksDoc[id]?.driverId === driverId).length;
  if (uses >= MAX_DRIVER_USES) {
    return reject('failed-precondition', `You have already picked ${driver.name} ${MAX_DRIVER_USES} times.`);
  }
  return { ok: true };
};
```

Replace the exports block with:

```js
module.exports = {
  PODIUM_SIZE,
  MAX_DRIVER_USES,
  eventsInPlay,
  computeSurvivalStandings,
  parseLeagueDate,
  resolveLockAt,
  validateSurvivalPick,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add functions/survival.js functions/test/survival.test.js
LOL_SKIP_REFS_HINT=1 git commit -m "feat(survival): server-side lock resolution and pick validation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Functions, rules, and deploy registration

**Files:**
- Modify: `functions/index.js` (require at top; new exports after `manualLeaderboardSync`)
- Modify: `functions/portal-callables.json`
- Modify: `deploy-staging.sh:19-21` (`STAGING_FUNCTIONS`)
- Modify: `firestore.rules` (after the `userPicks` block)

**Interfaces:**
- Consumes: `computeSurvivalStandings`, `validateSurvivalPick` (Tasks 1–2); `SEASON_EVENT_IDS`.
- Produces: callable `submitSurvivalPick({ eventId: string, driverId: string }) → { success: true }`; trigger `updateSurvivalStandings` writing `app_state/survival_standings` (`SurvivalStandings` + `computedAt`), or deleting it when config is absent / in setup.

- [ ] **Step 1: Add the require** next to the other local requires in `functions/index.js`:

```js
const { computeSurvivalStandings, validateSurvivalPick } = require("./survival");
```

- [ ] **Step 2: Add the functions** after the `manualLeaderboardSync` export:

```js
// --- PODIUM SURVIVAL CHALLENGE ---

// The app_state docs whose changes can move survival standings. The standings doc itself lives
// in app_state too and must never be in this set, or the trigger would re-fire on its own write.
const SURVIVAL_INPUT_DOCS = new Set(['race_results', 'cancelled_events', 'survival_config']);

const recalculateSurvivalStandings = async () => {
    const appState = db.collection('app_state');
    const [configSnap, resultsSnap, cancelledSnap, picksSnap] = await Promise.all([
        appState.doc('survival_config').get(),
        appState.doc('race_results').get(),
        appState.doc('cancelled_events').get(),
        db.collection('survival_picks').get(),
    ]);

    const picksByUser = {};
    picksSnap.forEach((d) => { picksByUser[d.id] = d.data(); });

    const standings = computeSurvivalStandings({
        config: configSnap.exists ? configSnap.data() : null,
        picksByUser,
        results: resultsSnap.exists ? resultsSnap.data() : {},
        cancelled: cancelledSnap.exists ? (cancelledSnap.data().events || {}) : {},
        eventOrder: [...SEASON_EVENT_IDS],
    });

    const standingsRef = appState.doc('survival_standings');
    if (!standings) {
        await standingsRef.delete();
        logger.info('Survival: no active challenge; standings cleared.');
        return;
    }
    await standingsRef.set({ ...standings, computedAt: admin.firestore.FieldValue.serverTimestamp() });
    logger.info(`Survival: standings recomputed through ${standings.lastProcessedEventId || 'no rounds'} (${standings.status}).`);
};

exports.updateSurvivalStandings = onDocumentWritten(
    { document: 'app_state/{docId}', timeoutSeconds: 120 },
    async (event) => {
        if (!SURVIVAL_INPUT_DOCS.has(event.params.docId)) return;
        await recalculateSurvivalStandings();
    }
);

exports.submitSurvivalPick = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login required.');
    }
    const uid = request.auth.uid;
    const { eventId, driverId } = request.data || {};
    if (typeof eventId !== 'string' || typeof driverId !== 'string' || !eventId || !driverId) {
        throw new HttpsError('invalid-argument', 'eventId and driverId are required.');
    }

    const appState = db.collection('app_state');
    const picksRef = db.collection('survival_picks').doc(uid);

    await db.runTransaction(async (t) => {
        const [configSnap, standingsSnap, entitiesSnap, schedulesSnap, locksSnap, cancelledSnap, picksSnap] = await t.getAll(
            appState.doc('survival_config'),
            appState.doc('survival_standings'),
            appState.doc('entities'),
            appState.doc('event_schedules'),
            appState.doc('form_locks'),
            appState.doc('cancelled_events'),
            picksRef,
        );

        const verdict = validateSurvivalPick({
            uid, eventId, driverId,
            config: configSnap.exists ? configSnap.data() : null,
            standings: standingsSnap.exists ? standingsSnap.data() : null,
            picksDoc: picksSnap.exists ? picksSnap.data() : {},
            drivers: entitiesSnap.exists ? (entitiesSnap.data().drivers || []) : [],
            schedule: schedulesSnap.exists ? schedulesSnap.data()[eventId] : null,
            formLocked: locksSnap.exists ? locksSnap.data()[eventId] === true : false,
            cancelled: cancelledSnap.exists ? (cancelledSnap.data().events || {}) : {},
            now: new Date(),
            eventOrder: [...SEASON_EVENT_IDS],
        });
        if (!verdict.ok) {
            throw new HttpsError(verdict.code, verdict.message);
        }

        t.set(picksRef, {
            [eventId]: { driverId, submittedAt: admin.firestore.FieldValue.serverTimestamp() },
        }, { merge: true });
    });

    logger.info(`Survival: ${uid} picked ${driverId} for ${eventId}.`);
    return { success: true };
});
```

- [ ] **Step 3: Register the functions.** In `functions/portal-callables.json`, add `"submitSurvivalPick"` to `functions` (alphabetical, after `sendPasswordResetLink`). In `deploy-staging.sh` replace the `STAGING_FUNCTIONS` declaration with:

```bash
readonly STAGING_FUNCTIONS=(manualLeaderboardSync sendAuthCode sendPasswordResetLink
                            submitSurvivalPick updateLeaderboardOnCancellation
                            updateLeaderboardOnResults updateSurvivalStandings
                            validateInvitationCode verifyAuthCode)
```

- [ ] **Step 4: Rules.** Insert after the `userPicks` block in `firestore.rules`:

```
    // --- Podium Survival picks ---
    // Written only by the submitSurvivalPick callable (Admin SDK), which enforces entry,
    // elimination, lock time and the three-use budget. Clients never write here.
    match /survival_picks/{userId} {
       allow read: if isSignedIn();
       allow write: if false;
    }
```

- [ ] **Step 5: Verify**

Run: `cd functions && node --check index.js && npm test && node -e 'JSON.parse(require("fs").readFileSync("portal-callables.json"))' && cd .. && bash -n deploy-staging.sh`
Expected: no syntax errors, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add functions/index.js functions/portal-callables.json deploy-staging.sh firestore.rules
LOL_SKIP_REFS_HINT=1 git commit -m "feat(functions): submitSurvivalPick callable and survival standings trigger" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Client types, service, hook, helpers

**Files:**
- Modify: `types.ts` (append)
- Modify: `services/firestoreService.ts` (import types; append section)
- Create: `hooks/useSurvival.ts`
- Create: `utils/survival.ts`

**Interfaces:**
- Produces (TS): `SurvivalConfig`, `SurvivalPick`, `SurvivalPicksDoc`, `SurvivalOutcome`, `SurvivalRound`, `SurvivalPlayer`, `SurvivalStandings`; `onSurvivalConfig`, `onSurvivalStandings`, `onAllSurvivalPicks`, `saveSurvivalConfig`, `startSurvivalChallenge`, `resetSurvivalChallenge`, `submitSurvivalPick`, `getPublicDisplayNames`; `useSurvival() → { config, standings, picks, names, loading }`; `SURVIVAL_MAX_USES`, `survivalRounds(events, config, cancelledEventIds)`, `currentSurvivalRound(rounds, raceResults)`, `isEventLocked(event, formLocks)`.

- [ ] **Step 1: Types** — append to `types.ts`:

```ts
/* --------------------------------------------------------- Podium Survival Challenge */

export interface SurvivalConfig {
    status: 'setup' | 'active';
    startEventId: string | null;
    /** Frozen at start: every user whose dues were Paid at that moment. */
    entrants: string[];
    prize?: string;
    startedAt?: any; // Firestore Timestamp
    startedBy?: string;
    updatedAt?: any; // Firestore Timestamp
}

export interface SurvivalPick {
    driverId: string;
    submittedAt?: any; // Firestore Timestamp
}

export type SurvivalPicksDoc = { [eventId: string]: SurvivalPick };

export type SurvivalOutcome = 'survived' | 'eliminated' | 'missed' | 'won';

export interface SurvivalRound {
    driverId: string | null;
    position: number | null;
    outcome: SurvivalOutcome;
}

export interface SurvivalPlayer {
    alive: boolean;
    eliminatedAt: string | null;
    reason: 'off-podium' | 'missed' | 'final' | null;
    usage: { [driverId: string]: number };
    rounds: { [eventId: string]: SurvivalRound };
}

/** Written only by the updateSurvivalStandings function. */
export interface SurvivalStandings {
    status: 'active' | 'complete';
    winners: string[];
    decidedAt: string | null;
    lastProcessedEventId: string | null;
    finalEventId: string | null;
    players: { [uid: string]: SurvivalPlayer };
    computedAt?: any;
}
```

- [ ] **Step 2: Service** — add `SurvivalConfig, SurvivalStandings, SurvivalPicksDoc` to the `../types.ts` import in `services/firestoreService.ts`, then append:

```ts
// --- Podium Survival Challenge ---

const survivalConfigRef = () => doc(db, 'app_state', 'survival_config');

export const onSurvivalConfig = (callback: (config: SurvivalConfig | null) => void) =>
    onSnapshot(survivalConfigRef(), (snap) => {
        callback(snap.exists() ? (snap.data() as SurvivalConfig) : null);
    }, (error) => {
        console.error("Survival config listener error:", error);
        callback(null);
    });

export const onSurvivalStandings = (callback: (standings: SurvivalStandings | null) => void) =>
    onSnapshot(doc(db, 'app_state', 'survival_standings'), (snap) => {
        callback(snap.exists() ? (snap.data() as SurvivalStandings) : null);
    }, (error) => {
        console.error("Survival standings listener error:", error);
        callback(null);
    });

export const onAllSurvivalPicks = (callback: (picks: { [uid: string]: SurvivalPicksDoc }) => void) =>
    onSnapshot(collection(db, 'survival_picks'), (snap) => {
        const all: { [uid: string]: SurvivalPicksDoc } = {};
        snap.forEach(d => { all[d.id] = d.data() as SurvivalPicksDoc; });
        callback(all);
    }, (error) => {
        console.error("Survival picks listener error:", error);
        callback({});
    });

/** Any config write also makes the standings function recompute — that is the admin "Recompute". */
export const saveSurvivalConfig = async (fields: Partial<SurvivalConfig>) => {
    await setDoc(survivalConfigRef(), { ...fields, updatedAt: serverTimestamp() }, { merge: true });
};

export const startSurvivalChallenge = async (startEventId: string, entrants: string[], adminUid: string, prize: string) => {
    await setDoc(survivalConfigRef(), {
        status: 'active', startEventId, entrants, prize,
        startedAt: serverTimestamp(), startedBy: adminUid, updatedAt: serverTimestamp(),
    }, { merge: true });
};

export const resetSurvivalChallenge = async () => {
    await setDoc(survivalConfigRef(), {
        status: 'setup', startEventId: null, entrants: [],
        startedAt: deleteField(), startedBy: deleteField(), updatedAt: serverTimestamp(),
    }, { merge: true });
};

export const submitSurvivalPick = async (eventId: string, driverId: string) => {
    const fn = getCallable<{ eventId: string; driverId: string }, { success: boolean }>('submitSurvivalPick');
    const result = await fn({ eventId, driverId });
    return result.data;
};

/** uid → public display name, for every member. public_users is world-readable and small. */
export const getPublicDisplayNames = async (): Promise<{ [uid: string]: string }> => {
    const snap = await getDocs(collection(db, 'public_users'));
    const names: { [uid: string]: string } = {};
    snap.forEach(d => { names[d.id] = (d.data().displayName as string) || 'Unknown Team'; });
    return names;
};
```

- [ ] **Step 3: Hook** — `hooks/useSurvival.ts`:

```ts
import { useEffect, useState } from 'react';
import type { SurvivalConfig, SurvivalPicksDoc, SurvivalStandings } from '../types.ts';
import {
    getPublicDisplayNames, onAllSurvivalPicks, onSurvivalConfig, onSurvivalStandings,
} from '../services/firestoreService.ts';

export interface SurvivalState {
    config: SurvivalConfig | null;
    standings: SurvivalStandings | null;
    picks: { [uid: string]: SurvivalPicksDoc };
    names: { [uid: string]: string };
    loading: boolean;
}

/** Everything the survival surfaces read, live. Picks and names only load when `full` is set. */
export const useSurvival = (full = true): SurvivalState => {
    const [config, setConfig] = useState<SurvivalConfig | null>(null);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [standings, setStandings] = useState<SurvivalStandings | null>(null);
    const [picks, setPicks] = useState<{ [uid: string]: SurvivalPicksDoc }>({});
    const [names, setNames] = useState<{ [uid: string]: string }>({});

    useEffect(() => onSurvivalConfig(c => { setConfig(c); setConfigLoaded(true); }), []);
    useEffect(() => onSurvivalStandings(setStandings), []);
    useEffect(() => (full ? onAllSurvivalPicks(setPicks) : undefined), [full]);
    useEffect(() => {
        if (!full) return;
        let live = true;
        getPublicDisplayNames().then(n => { if (live) setNames(n); }).catch(err => console.error(err));
        return () => { live = false; };
    }, [full]);

    return { config, standings, picks, names, loading: !configLoaded };
};
```

- [ ] **Step 4: Helpers** — `utils/survival.ts`:

```ts
import type { Event, RaceResults, SurvivalConfig } from '../types.ts';
import { parseLeagueDate } from './dateUtils.ts';

/** Mirrors MAX_DRIVER_USES in functions/survival.js. */
export const SURVIVAL_MAX_USES = 3;

/** The challenge's rounds in calendar order: from the start event on, cancelled ones dropped. */
export const survivalRounds = (events: Event[], config: SurvivalConfig | null, cancelledEventIds: Set<string>): Event[] => {
    if (!config?.startEventId) return [];
    const start = events.findIndex(e => e.id === config.startEventId);
    if (start === -1) return [];
    return events.slice(start).filter(e => !cancelledEventIds.has(e.id));
};

const hasGpResult = (raceResults: RaceResults, eventId: string) =>
    !!raceResults[eventId]?.grandPrixFinish?.some(Boolean);

/** The round being played: the first one without a Grand Prix result. */
export const currentSurvivalRound = (rounds: Event[], raceResults: RaceResults): Event | null =>
    rounds.find(e => !hasGpResult(raceResults, e.id)) ?? null;

export const isEventLocked = (event: Event, formLocks: { [eventId: string]: boolean }): boolean => {
    if (formLocks[event.id]) return true;
    const lock = parseLeagueDate(event.lockAtUtc);
    return lock ? lock.getTime() <= Date.now() : false;
};
```

- [ ] **Step 5: Verify**

Run: `npm run lint`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add types.ts services/firestoreService.ts hooks/useSurvival.ts utils/survival.ts
LOL_SKIP_REFS_HINT=1 git commit -m "feat(survival): client types, Firestore access, and live hook" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The `/survival` page

**Files:**
- Create: `components/icons/SurvivalIcon.tsx`
- Create: `components/survival/SurvivalDriverSheet.tsx`
- Create: `components/survival/SurvivalRoundCard.tsx`
- Create: `components/survival/SurvivalBoard.tsx`
- Create: `components/SurvivalPage.tsx`
- Modify: `App.tsx` (`Page` union, lazy import, `renderPage` case), `routes.ts` (`PAGE_PATHS`, `CANONICAL`, header comment)

**Interfaces:**
- Consumes: Task 4 exports; UI kit `PageHeader, Tile, SectionHeader, Chip, Countdown, Sheet, EmptyState, Banner, NUMERIC, teamColor`.
- Produces: `Page` value `'survival'` at `/survival`; default export `SurvivalPage` with props `{ user, events, allDrivers, allConstructors, cancelledEventIds, formLocks, raceResults }`.

- [ ] **Step 1: Icon** — `components/icons/SurvivalIcon.tsx` (a three-step podium):

```tsx
import React from 'react';

export const SurvivalIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M9 7h6v14H9zM2 12h6v9H2zM16 14h6v7h-6z" />
    <path d="M12 1.5l.9 1.8 2 .3-1.45 1.4.35 2L12 6.05 10.2 7l.35-2L9.1 3.6l2-.3z" />
  </svg>
);

export default SurvivalIcon;
```

- [ ] **Step 2: Driver sheet** — `components/survival/SurvivalDriverSheet.tsx`:

```tsx
import React from 'react';
import { Sheet, NUMERIC, teamColor } from '../ui/index.ts';
import type { Constructor, Driver } from '../../types.ts';
import { SURVIVAL_MAX_USES } from '../../utils/survival.ts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  drivers: Driver[];
  constructors: Constructor[];
  /** Uses already spent per driver, excluding the round being picked. */
  usage: { [driverId: string]: number };
  selectedId: string | null;
  onSelect: (driverId: string) => void;
}

export const SurvivalDriverSheet: React.FC<Props> = ({
  isOpen, onClose, drivers, constructors, usage, selectedId, onSelect,
}) => {
  const active = drivers.filter(d => d.isActive);
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Pick a podium finisher">
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {active.map(d => {
          const left = SURVIVAL_MAX_USES - (usage[d.id] || 0);
          const spent = left <= 0;
          const team = constructors.find(c => c.id === d.constructorId);
          const selected = d.id === selectedId;
          return (
            <li key={d.id}>
              <button
                type="button"
                disabled={spent}
                onClick={() => onSelect(d.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected ? 'border-primary-red bg-primary-red/10' : 'border-pure-white/10 bg-accent-gray/40 hover:border-pure-white/30'
                } ${spent ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="h-6 w-1 flex-none rounded-full" style={{ backgroundColor: teamColor(team?.id, team?.color) }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-pure-white">{d.name}</span>
                    <span className="block truncate text-[11px] text-highlight-silver">{team?.name ?? ''}</span>
                  </span>
                </span>
                <span className={`flex-none text-[11px] font-bold uppercase tracking-wider ${spent ? 'text-highlight-silver' : 'text-pure-white'} ${NUMERIC}`}>
                  {spent ? 'Used up' : `${left} left`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
};
```

(Before writing, confirm `teamColor`'s signature in `components/ui/tokens.ts` and adapt the call; if it takes a constructor id only, pass `team?.id`.)

- [ ] **Step 3: Round card** — `components/survival/SurvivalRoundCard.tsx`:

```tsx
import React, { useState } from 'react';
import { Tile, Countdown, Chip, NUMERIC } from '../ui/index.ts';
import { SurvivalDriverSheet } from './SurvivalDriverSheet.tsx';
import { useToast } from '../../contexts/ToastContext.tsx';
import { submitSurvivalPick } from '../../services/firestoreService.ts';
import { isEventLocked } from '../../utils/survival.ts';
import type {
  Constructor, Driver, Event, SurvivalConfig, SurvivalPicksDoc, SurvivalStandings, User,
} from '../../types.ts';

interface Props {
  user: User;
  config: SurvivalConfig;
  standings: SurvivalStandings | null;
  myPicks: SurvivalPicksDoc;
  round: Event | null;
  rounds: Event[];
  isFinal: boolean;
  drivers: Driver[];
  constructors: Constructor[];
  formLocks: { [eventId: string]: boolean };
  eventName: (id: string | null) => string;
}

const Message: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <Tile padding="md">
    <h3 className="text-sm font-black uppercase italic tracking-wide text-pure-white">{title}</h3>
    <p className="mt-1.5 text-xs leading-relaxed text-highlight-silver">{body}</p>
  </Tile>
);

export const SurvivalRoundCard: React.FC<Props> = ({
  user, config, standings, myPicks, round, rounds, isFinal, drivers, constructors, formLocks, eventName,
}) => {
  const { showToast } = useToast();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!config.entrants.includes(user.id)) {
    return <Message title="Not entered" body="Entry closed when the challenge started. Only members whose dues were paid at that moment are in." />;
  }
  const me = standings?.players[user.id];
  if (me && !me.alive) {
    const how = me.reason === 'missed' ? 'no valid pick' : me.reason === 'final' ? 'beaten in the final round' : 'driver missed the podium';
    return <Message title={`Eliminated · ${eventName(me.eliminatedAt)}`} body={`Out on ${how}. You can still follow the rest of the challenge below.`} />;
  }
  if (standings?.status === 'complete') return null;
  if (!round) return <Message title="Waiting on results" body="Every round has been played. Standings update as soon as results are entered." />;

  const locked = isEventLocked(round, formLocks);
  const current = myPicks[round.id]?.driverId ?? null;
  const currentDriver = drivers.find(d => d.id === current);

  // Uses spent on other rounds that are still part of the challenge.
  const roundIds = new Set(rounds.map(r => r.id));
  const usage: { [driverId: string]: number } = {};
  Object.entries(myPicks).forEach(([eid, p]) => {
    if (eid !== round.id && roundIds.has(eid) && p?.driverId) usage[p.driverId] = (usage[p.driverId] || 0) + 1;
  });

  const choose = async (driverId: string) => {
    setSheetOpen(false);
    setSaving(true);
    try {
      await submitSurvivalPick(round.id, driverId);
      showToast('Survival pick locked in.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not save your pick.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tile padding="md" accent="gp" accentEdge>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black uppercase italic tracking-wide text-pure-white">{round.name}</h3>
            {isFinal && <Chip label="Final round" tone="warning" size="xs" />}
          </div>
          <p className="mt-1 text-xs text-highlight-silver">
            {isFinal ? 'Highest finisher among the survivors wins.' : 'Pick one driver to finish P1–P3 in the Grand Prix.'}
          </p>
        </div>
        {!locked && <Countdown targetDate={round.lockAtUtc} size="sm" label="Locks in" />}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-pure-white/10 bg-carbon-black/40 px-3 py-3">
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">Your pick</span>
          <span className="block truncate text-lg font-black italic text-pure-white">{currentDriver?.name ?? 'No pick yet'}</span>
        </div>
        {locked ? (
          <Chip label={current ? 'Locked' : 'Locked · no pick'} tone={current ? 'neutral' : 'danger'} size="sm" />
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => setSheetOpen(true)}
            className="rounded-lg bg-primary-red px-4 py-2 text-[11px] font-black uppercase tracking-wider text-on-primary transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {saving ? 'Saving…' : current ? 'Change pick' : 'Make pick'}
          </button>
        )}
      </div>
      {!locked && !current && (
        <p className="mt-2 text-[11px] text-primary-red">No pick by lock means elimination.</p>
      )}
      <p className={`mt-3 text-[11px] text-highlight-silver ${NUMERIC}`}>
        Each driver can be picked 3 times in the whole challenge.
      </p>

      <SurvivalDriverSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        drivers={drivers}
        constructors={constructors}
        usage={usage}
        selectedId={current}
        onSelect={choose}
      />
    </Tile>
  );
};
```

(Confirm `useToast().showToast`'s second argument accepts `'success' | 'error'` in `contexts/ToastContext.tsx`; adapt if the names differ.)

- [ ] **Step 4: Board** — `components/survival/SurvivalBoard.tsx`:

```tsx
import React from 'react';
import { Tile, SectionHeader, Chip, NUMERIC } from '../ui/index.ts';
import { isEventLocked } from '../../utils/survival.ts';
import type { Driver, Event, SurvivalConfig, SurvivalPicksDoc, SurvivalRound, SurvivalStandings } from '../../types.ts';

interface Props {
  config: SurvivalConfig;
  standings: SurvivalStandings | null;
  picks: { [uid: string]: SurvivalPicksDoc };
  names: { [uid: string]: string };
  rounds: Event[];
  round: Event | null;
  drivers: Driver[];
  formLocks: { [eventId: string]: boolean };
  currentUserId: string;
}

const OUTCOME_TONE: Record<SurvivalRound['outcome'], 'success' | 'danger' | 'warning'> = {
  survived: 'success', won: 'warning', eliminated: 'danger', missed: 'danger',
};

export const SurvivalBoard: React.FC<Props> = ({
  config, standings, picks, names, rounds, round, drivers, formLocks, currentUserId,
}) => {
  const code = (id: string | null) => {
    if (!id) return '—';
    const d = drivers.find(x => x.id === id);
    return d ? d.name.split(' ').slice(-1)[0].slice(0, 3).toUpperCase() : id.toUpperCase();
  };
  const name = (uid: string) => names[uid] || 'Unknown Team';
  const roundOpenPicksHidden = round ? !isEventLocked(round, formLocks) : true;
  const roundIndex = (eid: string | null) => rounds.findIndex(r => r.id === eid);

  const rows = config.entrants.map(uid => ({ uid, player: standings?.players[uid] }));
  const alive = rows.filter(r => !r.player || r.player.alive)
    .sort((a, b) => name(a.uid).localeCompare(name(b.uid)));
  const out = rows.filter(r => r.player && !r.player.alive)
    .sort((a, b) => roundIndex(b.player!.eliminatedAt) - roundIndex(a.player!.eliminatedAt) || name(a.uid).localeCompare(name(b.uid)));

  const Row: React.FC<{ uid: string; dim?: boolean }> = ({ uid, dim }) => {
    const player = standings?.players[uid];
    const played = rounds.filter(r => player?.rounds[r.id]);
    const livePick = round ? picks[uid]?.[round.id]?.driverId ?? null : null;
    return (
      <li className={`flex flex-wrap items-center justify-between gap-2 border-b border-pure-white/5 py-2.5 last:border-0 ${dim ? 'opacity-60' : ''}`}>
        <span className={`truncate text-sm font-bold ${uid === currentUserId ? 'text-primary-red' : 'text-pure-white'}`}>{name(uid)}</span>
        <span className="flex flex-wrap items-center gap-1">
          {played.map(r => {
            const res = player!.rounds[r.id];
            const label = `${code(res.driverId)}${res.position ? ` P${res.position}` : ''}`;
            return <Chip key={r.id} label={<span className={NUMERIC}>{label}</span>} tone={OUTCOME_TONE[res.outcome]} size="xs" />;
          })}
          {!dim && round && !player?.rounds[round.id] && (
            roundOpenPicksHidden
              ? <Chip label={livePick ? 'Picked' : 'Waiting'} tone="neutral" size="xs" />
              : <Chip label={livePick ? code(livePick) : 'No pick'} tone={livePick ? 'info' : 'danger'} size="xs" />
          )}
        </span>
      </li>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <SectionHeader title="Still standing" subtitle={`${alive.length} of ${config.entrants.length}`} />
        <Tile padding="md">
          {alive.length ? <ul>{alive.map(r => <Row key={r.uid} uid={r.uid} />)}</ul>
            : <p className="text-xs text-highlight-silver">Nobody left.</p>}
        </Tile>
      </div>
      <div>
        <SectionHeader title="Eliminated" subtitle={`${out.length}`} />
        <Tile padding="md">
          {out.length ? <ul>{out.map(r => <Row key={r.uid} uid={r.uid} dim />)}</ul>
            : <p className="text-xs text-highlight-silver">Everyone is still in.</p>}
        </Tile>
      </div>
    </div>
  );
};
```

- [ ] **Step 5: Page** — `components/SurvivalPage.tsx`:

```tsx
import React, { useMemo } from 'react';
import { PageHeader, EmptyState, Banner, Chip } from './ui/index.ts';
import { SurvivalIcon } from './icons/SurvivalIcon.tsx';
import { SurvivalRoundCard } from './survival/SurvivalRoundCard.tsx';
import { SurvivalBoard } from './survival/SurvivalBoard.tsx';
import { useSurvival } from '../hooks/useSurvival.ts';
import { currentSurvivalRound, survivalRounds } from '../utils/survival.ts';
import type { Constructor, Driver, Event, RaceResults, User } from '../types.ts';

interface SurvivalPageProps {
  user: User | null;
  events: Event[];
  allDrivers: Driver[];
  allConstructors: Constructor[];
  cancelledEventIds: Set<string>;
  formLocks: { [eventId: string]: boolean };
  raceResults: RaceResults;
}

/**
 * Podium Survival Challenge: one driver per Grand Prix, podium or out. Standings and pick
 * validation are server-side (functions/survival.js); this page only reads and submits.
 */
const SurvivalPage: React.FC<SurvivalPageProps> = ({
  user, events, allDrivers, allConstructors, cancelledEventIds, formLocks, raceResults,
}) => {
  const { config, standings, picks, names, loading } = useSurvival();

  const rounds = useMemo(() => survivalRounds(events, config, cancelledEventIds), [events, config, cancelledEventIds]);
  const round = useMemo(() => currentSurvivalRound(rounds, raceResults), [rounds, raceResults]);
  const eventName = (id: string | null) => events.find(e => e.id === id)?.name ?? 'Unknown round';

  const header = (
    <PageHeader
      title="PODIUM SURVIVAL"
      icon={SurvivalIcon}
      subtitle={config?.prize ? `Prize: ${config.prize}` : undefined}
      rightAction={config?.status === 'active' && standings?.status !== 'complete'
        ? <Chip label={`Round ${Math.max(1, rounds.findIndex(r => r.id === round?.id) + 1)} of ${rounds.length}`} tone="neutral" size="sm" />
        : undefined}
    />
  );

  if (loading || !user) return <div className="w-full max-w-5xl mx-auto px-2 md:px-0">{header}</div>;

  if (!config || config.status !== 'active') {
    return (
      <div className="w-full max-w-5xl mx-auto px-2 md:px-0 pb-24 md:pb-12">
        {header}
        <EmptyState
          icon={SurvivalIcon}
          title="No challenge running"
          description="Pick one driver each Grand Prix to finish on the podium. Miss and you are out. Last one standing wins. The admins will announce the start."
        />
      </div>
    );
  }

  const winners = standings?.status === 'complete' ? standings.winners : null;

  return (
    <div className="w-full max-w-5xl mx-auto px-2 md:px-0 pb-24 md:pb-12 space-y-6">
      {header}
      {winners && (
        <Banner
          tone={winners.length ? 'success' : 'neutral'}
          title={winners.length ? `${winners.length > 1 ? 'Co-winners' : 'Winner'}: ${winners.map(u => names[u] || 'Unknown Team').join(', ')}` : 'No winner this time'}
          message={winners.length
            ? `Decided at ${eventName(standings!.decidedAt)}.`
            : `Everyone still standing went out together at ${eventName(standings!.decidedAt)}.`}
        />
      )}
      <SurvivalRoundCard
        user={user}
        config={config}
        standings={standings}
        myPicks={picks[user.id] || {}}
        round={round}
        rounds={rounds}
        isFinal={!!round && round.id === rounds[rounds.length - 1]?.id}
        drivers={allDrivers}
        constructors={allConstructors}
        formLocks={formLocks}
        eventName={eventName}
      />
      <SurvivalBoard
        config={config}
        standings={standings}
        picks={picks}
        names={names}
        rounds={rounds}
        round={winners ? null : round}
        drivers={allDrivers}
        formLocks={formLocks}
        currentUserId={user.id}
      />
    </div>
  );
};

export default SurvivalPage;
```

- [ ] **Step 6: Routing.** In `routes.ts`: add `'survival': '/survival',` to `PAGE_PATHS` (after `'league-hub'`), add `'survival'` to `CANONICAL`, and change "six canonical surfaces" in the header comment to "seven canonical surfaces (Survival is reached by link, not nav)". In `App.tsx`: add `| 'survival'` to `export type Page`; add `const SurvivalPage = lazy(() => import('./components/SurvivalPage.tsx'));` beside the other lazy imports; add before `case 'profile':` in `renderPage`:

```tsx
      case 'survival':
        return <SurvivalPage
            user={user}
            events={mergedEvents}
            allDrivers={allDrivers}
            allConstructors={allConstructors}
            cancelledEventIds={cancelledEventIds}
            formLocks={formLocks}
            raceResults={raceResults}
        />;
```

- [ ] **Step 7: Verify**

Run: `npm run lint`
Expected: exit 0. Fix any `Record<Page, …>` elsewhere that now needs a `survival` key (tsc names them).

- [ ] **Step 8: Commit**

```bash
git add components/icons/SurvivalIcon.tsx components/survival components/SurvivalPage.tsx App.tsx routes.ts
LOL_SKIP_REFS_HINT=1 git commit -m "feat(survival): /survival page with round card and standings board" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Admin tool and entry points

**Files:**
- Create: `components/SurvivalAdminPage.tsx`
- Create: `components/survival/SurvivalEntryCard.tsx`
- Modify: `routes.ts` (`ADMIN_TOOLS`, `LOCKED_ADMIN_TOOLS` unchanged), `App.tsx` (lazy import, admin `case 'survival'`, `LeagueHubPage` prop), `components/AdminPage.tsx` (tile in "Race Weekend"), `components/LeagueHubPage.tsx`, `components/RacePage.tsx`

**Interfaces:**
- Consumes: Task 4 service functions; `AdminToolShell`, `ConfirmModal`; `getAllUsers(pageSize, lastDoc)`.
- Produces: admin tool `'survival'` at `/admin?tool=survival`; `SurvivalEntryCard({ onOpen: () => void; hideWhenInactive?: boolean })`.

- [ ] **Step 1: Entry card** — `components/survival/SurvivalEntryCard.tsx`:

```tsx
import React from 'react';
import { Tile, Chip } from '../ui/index.ts';
import { SurvivalIcon } from '../icons/SurvivalIcon.tsx';
import { useSurvival } from '../../hooks/useSurvival.ts';

interface Props {
  onOpen: () => void;
  /** Race only advertises a running challenge; League always shows the way in. */
  hideWhenInactive?: boolean;
}

export const SurvivalEntryCard: React.FC<Props> = ({ onOpen, hideWhenInactive }) => {
  const { config, standings } = useSurvival(false);
  const running = config?.status === 'active';
  if (hideWhenInactive && !running) return null;
  const status = !running ? 'Not running' : standings?.status === 'complete' ? 'Finished' : 'Live';
  return (
    <Tile padding="md" onClick={onOpen} className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-3 min-w-0">
        <SurvivalIcon className="h-6 w-6 flex-none text-primary-red" />
        <span className="min-w-0">
          <span className="block text-sm font-black uppercase italic tracking-wide text-pure-white">Podium Survival</span>
          <span className="block truncate text-xs text-highlight-silver">One driver a race. Podium or out.</span>
        </span>
      </span>
      <Chip label={status} tone={status === 'Live' ? 'success' : 'neutral'} size="xs" />
    </Tile>
  );
};
```

- [ ] **Step 2: Admin page** — `components/SurvivalAdminPage.tsx`:

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Tile, SectionHeader, Chip, NUMERIC } from './ui/index.ts';
import { AdminToolShell, ConfirmModal } from './admin/index.ts';
import { SurvivalIcon } from './icons/SurvivalIcon.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { useSurvival } from '../hooks/useSurvival.ts';
import {
  getAllUsers, resetSurvivalChallenge, saveSurvivalConfig, startSurvivalChallenge,
} from '../services/firestoreService.ts';
import { isEventLocked } from '../utils/survival.ts';
import type { Event, User } from '../types.ts';
import type { AdminDestination } from '../routes.ts';

interface Props {
  setAdminSubPage: (page: AdminDestination) => void;
  user: User | null;
  events: Event[];
  cancelledEventIds: Set<string>;
  formLocks: { [eventId: string]: boolean };
}

const fetchPaidUsers = async (): Promise<User[]> => {
  const all: User[] = [];
  let cursor: any = null;
  do {
    const { users, lastDoc } = await getAllUsers(100, cursor);
    all.push(...users);
    cursor = users.length === 100 ? lastDoc : null;
  } while (cursor);
  return all.filter(u => u.duesPaidStatus === 'Paid');
};

const SurvivalAdminPage: React.FC<Props> = ({ setAdminSubPage, user, events, cancelledEventIds, formLocks }) => {
  const { showToast } = useToast();
  const { config, standings, names } = useSurvival();
  const [paid, setPaid] = useState<User[]>([]);
  const [startEventId, setStartEventId] = useState('');
  const [prize, setPrize] = useState('');
  const [confirm, setConfirm] = useState<'start' | 'reset' | null>(null);
  const [busy, setBusy] = useState(false);

  const running = config?.status === 'active';
  useEffect(() => { setPrize(config?.prize ?? ''); }, [config?.prize]);
  useEffect(() => {
    if (running) return;
    fetchPaidUsers().then(setPaid).catch(err => { console.error(err); showToast('Could not load members.', 'error'); });
  }, [running]);

  const startable = useMemo(
    () => events.filter(e => !cancelledEventIds.has(e.id) && !isEventLocked(e, formLocks)),
    [events, cancelledEventIds, formLocks],
  );
  useEffect(() => { if (!startEventId && startable[0]) setStartEventId(startable[0].id); }, [startable, startEventId]);

  const eventName = (id: string | null | undefined) => events.find(e => e.id === id)?.name ?? '—';
  const aliveCount = config ? config.entrants.filter(u => standings?.players[u]?.alive !== false).length : 0;
  const roundsPlayed = !!standings?.lastProcessedEventId;

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); showToast(ok, 'success'); }
    catch (err: any) { console.error(err); showToast(err?.message || 'Something went wrong.', 'error'); }
    finally { setBusy(false); setConfirm(null); }
  };

  const field = 'w-full rounded-lg border border-pure-white/10 bg-carbon-black/50 px-3 py-2 text-sm text-pure-white focus:border-primary-red focus:outline-none';

  return (
    <AdminToolShell title="Podium Survival" icon={SurvivalIcon} subtitle="Start and run the elimination challenge" setAdminSubPage={setAdminSubPage}>
      <div className="w-full max-w-3xl mx-auto px-2 md:px-0 pb-20 space-y-6">
        <Tile padding="md">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-highlight-silver" htmlFor="survival-prize">Prize</label>
          <div className="mt-2 flex gap-2">
            <input id="survival-prize" className={field} value={prize} maxLength={120} placeholder="To be announced" onChange={e => setPrize(e.target.value)} />
            <button
              type="button" disabled={busy || prize === (config?.prize ?? '')}
              onClick={() => act(() => saveSurvivalConfig({ prize: prize.trim() }), 'Prize saved.')}
              className="rounded-lg border border-pure-white/20 px-4 text-[11px] font-black uppercase tracking-wider text-pure-white hover:border-pure-white/40 disabled:opacity-40"
            >Save</button>
          </div>
        </Tile>

        {!running ? (
          <>
            <Tile padding="md">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-highlight-silver" htmlFor="survival-start">Start race</label>
              <select id="survival-start" className={`${field} mt-2`} value={startEventId} onChange={e => setStartEventId(e.target.value)}>
                {startable.map(e => <option key={e.id} value={e.id}>R{e.round} · {e.name}</option>)}
              </select>
              <p className="mt-2 text-xs text-highlight-silver">Only races whose picks are still open can start the challenge.</p>
            </Tile>

            <div>
              <SectionHeader title="Entrants" subtitle={`${paid.length} members with dues paid right now`} />
              <Tile padding="md">
                {paid.length
                  ? <ul className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm text-pure-white">{paid.map(u => <li key={u.id} className="truncate">{u.displayName}</li>)}</ul>
                  : <p className="text-xs text-highlight-silver">No paid members yet.</p>}
              </Tile>
            </div>

            <button
              type="button" disabled={busy || !startEventId || paid.length === 0}
              onClick={() => setConfirm('start')}
              className="w-full rounded-lg bg-primary-red px-4 py-3 text-xs font-black uppercase tracking-wider text-on-primary hover:bg-red-600 disabled:opacity-40"
            >Start challenge</button>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                ['Started', eventName(config!.startEventId)],
                ['Entrants', String(config!.entrants.length)],
                ['Alive', String(aliveCount)],
              ].map(([label, value]) => (
                <Tile key={label} padding="md" className="text-center">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-highlight-silver">{label}</span>
                  <span className={`mt-1 block truncate text-lg font-black italic text-pure-white ${NUMERIC}`}>{value}</span>
                </Tile>
              ))}
            </div>
            <Tile padding="md" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-pure-white">
                  Standings through <strong>{eventName(standings?.lastProcessedEventId)}</strong>
                </span>
                <Chip label={standings?.status === 'complete' ? 'Complete' : 'Live'} tone={standings?.status === 'complete' ? 'neutral' : 'success'} size="xs" />
              </div>
              {standings?.status === 'complete' && (
                <p className="text-sm text-pure-white">
                  {standings.winners.length ? `Winner: ${standings.winners.map(u => names[u] || u).join(', ')}` : 'No winner.'}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button" disabled={busy}
                  onClick={() => act(() => saveSurvivalConfig({}), 'Recompute requested. Standings refresh in a few seconds.')}
                  className="rounded-lg border border-pure-white/20 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-pure-white hover:border-pure-white/40 disabled:opacity-40"
                >Recompute standings</button>
                <button
                  type="button" disabled={busy || roundsPlayed}
                  onClick={() => setConfirm('reset')}
                  title={roundsPlayed ? 'A round has already been scored' : undefined}
                  className="rounded-lg border border-primary-red/50 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-primary-red hover:border-primary-red disabled:opacity-40"
                >Cancel challenge</button>
              </div>
              <p className="text-xs text-highlight-silver">Standings recompute on their own whenever race results or cancellations change. A challenge can only be cancelled before its first round is scored.</p>
            </Tile>
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirm === 'start'}
        onClose={() => setConfirm(null)}
        onConfirm={() => act(() => startSurvivalChallenge(startEventId, paid.map(u => u.id), user?.id || '', prize.trim()), 'Podium Survival has started.')}
        title="Start Podium Survival?"
        consequence={`${paid.length} members are entered from ${eventName(startEventId)}. Nobody can join after this.`}
        confirmLabel="Start"
        tone="warning"
        busy={busy}
      />
      <ConfirmModal
        isOpen={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        onConfirm={() => act(resetSurvivalChallenge, 'Challenge cancelled.')}
        title="Cancel the challenge?"
        consequence="Entrants are cleared and standings removed. Picks already submitted stay stored and will count again if the challenge restarts from the same race."
        confirmLabel="Cancel challenge"
        tone="danger"
        busy={busy}
      />
    </AdminToolShell>
  );
};

export default SurvivalAdminPage;
```

(Confirm `ConfirmModal`'s remaining required props in `components/admin/ConfirmModal.tsx` lines 8–15 and supply them.)

- [ ] **Step 3: Wire admin.** `routes.ts`: append `'survival'` to `ADMIN_TOOLS`. `App.tsx`: `const SurvivalAdminPage = lazy(() => import('./components/SurvivalAdminPage.tsx'));` and in the admin switch before `default:`:

```tsx
            case 'survival':
                return <SurvivalAdminPage setAdminSubPage={setAdminSubPage} user={user} events={mergedEvents} cancelledEventIds={cancelledEventIds} formLocks={formLocks} />;
```

`components/AdminPage.tsx`: import `SurvivalIcon` and add to the "Race Weekend" group's `tools`:

```tsx
                {
                    icon: SurvivalIcon,
                    title: 'Podium Survival',
                    description: 'Start the elimination challenge, set the prize, and watch who is left.',
                    tool: 'survival',
                },
```

- [ ] **Step 4: Entry points.** `LeagueHubPage`: add prop `onOpenSurvival: () => void`, render above `<LeagueLinks />`:

```tsx
        <div className="mb-6">
          <SurvivalEntryCard onOpen={onOpenSurvival} />
        </div>
```

and in `App.tsx` pass `onOpenSurvival={() => navigateToPage('survival')}`. `RacePage`: in the picks view, wrap the returned `HomePage` as:

```tsx
        <>
          <div className="px-4 pt-3 max-w-7xl w-full mx-auto">
            <SurvivalEntryCard onOpen={() => setActivePage('survival')} hideWhenInactive />
          </div>
          <HomePage … unchanged … />
        </>
```

(Check `setActivePage`'s type in `RacePageProps` accepts `Page`.)

- [ ] **Step 5: Verify**

Run: `npm run lint && npm run build -- --mode staging`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add components/SurvivalAdminPage.tsx components/survival/SurvivalEntryCard.tsx routes.ts App.tsx components/AdminPage.tsx components/LeagueHubPage.tsx components/RacePage.tsx
LOL_SKIP_REFS_HINT=1 git commit -m "feat(survival): admin tool and League/Race entry points" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Final verification and stash

- [ ] **Step 1:** `cd functions && npm test` → all pass. `npm run lint` → 0. `npm run build -- --mode staging` → success.
- [ ] **Step 2:** Update the spec's `rounds[...].outcome` enum to `'survived' | 'eliminated' | 'missed' | 'won'` and `survival_picks` read to signed-in, matching what shipped; commit `docs(survival): align spec with implementation`.
- [ ] **Step 3:** `git push -u origin feat/podium-survival`. Do **not** merge.
- [ ] **Step 4:** Update the Notion item: Status → In Progress (or the database's nearest "parked" status), Commits → branch + head SHA, Evidence → one line: built and stashed on `feat/podium-survival`, not deployed; release needs staging deploy, portal callable, formula-fantasy-1 functions (Node 22 upgrade), rules; prize TBD.
