const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { SEASON_EVENT_IDS } = require('../season-events');
const { SEASON_EVENT_IDS: apiSeasonEventIds } = require('../../backend/api/season-events');

/**
 * The calendar lives in three places — the repo-root `constants.ts` (the source of truth, read by
 * the browser) and a CommonJS mirror in each server package, because neither server can import
 * TypeScript. These tests are what keeps the three from drifting.
 */
const readConstantsEventIds = () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'constants.ts'),
    'utf8',
  );
  const events = source.match(/export const EVENTS: Event\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(events, 'could not locate the EVENTS array in constants.ts');
  return [...events[1].matchAll(/\bid:\s*'([a-z0-9_]+)'/g)].map((match) => match[1]);
};

test('mirrors every event id in constants.ts', () => {
  assert.deepEqual([...SEASON_EVENT_IDS].sort(), readConstantsEventIds().sort());
});

test('the containerised API mirror matches the Functions one', () => {
  assert.deepEqual([...apiSeasonEventIds].sort(), [...SEASON_EVENT_IDS].sort());
});

test('holds the 23-round 2026 calendar', () => {
  assert.equal(SEASON_EVENT_IDS.size, 23);
});

test('Bahrain is on the calendar and Saudi Arabia is not', () => {
  assert.ok(SEASON_EVENT_IDS.has('bhr_26'));
  assert.ok(!SEASON_EVENT_IDS.has('sau_26'));
});
