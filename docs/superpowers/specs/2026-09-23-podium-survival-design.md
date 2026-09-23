# Podium Survival Challenge — design

Status: approved 2026-09-23. Built on `feat/podium-survival`, stashed (not merged to `staging`,
not deployed). Source: Notion F1 Work Items, "Podium Survival Challenge — New Game Mode".

## The game

A standalone elimination game beside normal GP picks. Each round, every surviving entrant picks
one driver to finish P1–P3 in the **main Grand Prix** (sprints never count).

| Rule | Behaviour |
|---|---|
| Entry | Every user with dues `Paid` at the moment the admin starts the challenge. Entrants are frozen at start; paying later does not join. |
| Lock | Same instant as that event's GP picks lock (schedule `customLockAt` → sprint quali / quali), plus the admin `form_locks` override. |
| Survive | Picked driver is in `grandPrixFinish[0..2]`. |
| Eliminated | Picked driver is not in P1–P3, **or** no pick was submitted before lock. Permanent. |
| Driver budget | Max 3 picks of any one driver per user for the challenge. Since any failed pick eliminates, "3 successful uses" and "3 picks" are the same thing. |
| Cancelled GP | Round skipped: nobody eliminated, no use spent. |
| Last one standing | If exactly one entrant is alive after a round, the challenge ends and they win. |
| Mass elimination | If every alive entrant is eliminated in the same (non-final) round, the challenge ends with no winner. |
| Final GP | The last non-cancelled season event. The winner is whoever, among entrants alive going into it **who submitted a pick**, had the highest-finishing driver — podium or not ("P7 beats P8"). Results store only P1–P10, so drivers outside the top 10 are unranked; ties (same driver, or all unranked) are co-winners. If nobody alive submitted a final pick, no winner. |
| Results truth | Whatever `grandPrixFinish` holds. DSQs/DNFs are handled by the admin editing results; the standings recompute. |

## Data model

| Doc | Writer | Read | Shape |
|---|---|---|---|
| `app_state/survival_config` | admin client | signed-in | `{ status: 'setup' \| 'active', startEventId, entrants: uid[], prize?, startedAt?, startedBy?, updatedAt }` |
| `survival_picks/{uid}` | `submitSurvivalPick` callable only (client writes denied by rules) | public | `{ [eventId]: { driverId, submittedAt } }` |
| `app_state/survival_standings` | `updateSurvivalStandings` trigger | signed-in | `{ status: 'active' \| 'complete', winners: uid[], decidedAt: eventId \| null, lastProcessedEventId, players: { [uid]: { alive, eliminatedAt, reason, usage, rounds } }, computedAt }` |

`rounds[eventId] = { driverId \| null, position \| null, outcome: 'survived' \| 'eliminated' \| 'missed' \| 'final' }`.
`reason` is `'off-podium' \| 'missed' \| 'final'`.

Standings are one document rather than a collection: ~40 players, one listener, and it follows
the `app_state/*` convention.

## Server (`functions/`)

- `survival.js` — pure, no Firestore:
  - `computeSurvivalStandings({ config, picksByUser, results, cancelled, eventOrder })`
  - `validateSurvivalPick({ uid, eventId, driverId, config, standings, picksDoc, drivers, lockAt, formLocked, cancelled, now, eventOrder })` → `{ ok } \| { ok: false, code, message }`
  - `resolveLockAt(schedule)` — mirrors `App.tsx` `mergedEvents` minus the constants fallback.
- `submitSurvivalPick` (onCall): auth → load config, standings, entities, schedules, form locks,
  cancelled events, own picks → validate → transactional write of `survival_picks/{uid}.{eventId}`.
  A missing schedule for the event **rejects** (fail closed); the server has no copy of the
  constants' `lockAtUtc`.
- `updateSurvivalStandings` (onDocumentWritten `app_state/{docId}`): acts only for
  `race_results`, `cancelled_events`, `survival_config`; recomputes and overwrites
  `app_state/survival_standings`. Never reacts to its own document. If config is absent or in
  `setup`, it deletes stale standings.
- Calendar order is `SEASON_EVENT_IDS` (insertion-ordered, mirrors `constants.ts`).

## Client

- `types.ts`: `SurvivalConfig`, `SurvivalPick`, `SurvivalPicksDoc`, `SurvivalPlayer`, `SurvivalStandings`.
- `firestoreService.ts`: `onSurvivalConfig`, `onSurvivalStandings`, `onAllSurvivalPicks`,
  `saveSurvivalConfig`; `callableService`-backed `submitSurvivalPick`.
- `/survival` — new canonical `Page` (`'survival'`), not in the nav. Your-round card (countdown,
  driver sheet with uses-left, current pick, not-entered / eliminated / dues states),
  leaderboard (Active / Eliminated, per-round outcome chips), winner banner. Other players'
  picks for an event render only once it is locked.
- Admin tool `survival`: start event, entrants preview (currently Paid users), start with
  confirm, prize text, recompute (touch `updatedAt`), reset while in setup.
- Entry points: League hub link; Race card while a challenge is active.

## Testing

`functions/test/survival.test.js` (node --test) covers the engine and validator. `npm run lint`,
`npm run build -- --mode staging`. No emulator exists; end-to-end needs a staging deploy.

## Delivery

Feature branch only. Before release: staging deploy picks up the two new functions (added to
`STAGING_FUNCTIONS`); prod needs `submitSurvivalPick` in the portal (`portal-callables.json`, no
deploy script yet), `updateSurvivalStandings` in `formula-fantasy-1` (which is the Node 20→22
runtime upgrade), and the rules deploy. Prize is still TBD.
