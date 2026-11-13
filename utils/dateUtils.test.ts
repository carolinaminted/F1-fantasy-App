import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLeagueDate, leagueZoneName, LEAGUE_TIMEZONE } from './dateUtils.ts';

// Schedule and lock times are stored as New York wall-clock strings and read in whatever zone the
// member's browser is in. The answer must not depend on that zone, including on the days New York
// or the browser changes its clocks (Europe and Australia change on different weekends).
const BROWSER_ZONES = [
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Phoenix',
  'Europe/London', 'Europe/Berlin', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney', 'UTC',
];

const inBrowserZone = (zone: string, fn: () => void) => {
  const prev = process.env.TZ;
  process.env.TZ = zone;
  try {
    // Proves the switch took, so a passing run is not just the machine's own zone eight times.
    const resolve = (timeZone?: string) => new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
    assert.equal(resolve(), resolve(zone), `TZ switch to ${zone} did not take`);
    fn();
  } finally {
    process.env.TZ = prev;
  }
};

const iso = (s?: string) => parseLeagueDate(s)?.toISOString() ?? null;

// 2027: New York springs forward Sun Mar 14 at 02:00 EST (07:00Z), falls back Sun Nov 7 at 02:00 EDT (06:00Z).
const CASES: [input: string, utc: string, why: string][] = [
  ['2027-01-15T12:00', '2027-01-15T17:00:00.000Z', 'winter, EST'],
  ['2027-07-15T12:00', '2027-07-15T16:00:00.000Z', 'summer, EDT'],
  ['2027-03-12T10:30', '2027-03-12T15:30:00.000Z', 'Bahrain sprint qualifying, the 2027 round 1 lock'],
  ['2027-03-14T01:30', '2027-03-14T06:30:00.000Z', 'just before spring forward'],
  ['2027-03-14T03:30', '2027-03-14T07:30:00.000Z', 'just after spring forward'],
  ['2027-03-14T11:00', '2027-03-14T15:00:00.000Z', 'Bahrain race, the morning clocks change'],
  ['2027-03-14T02:30', '2027-03-14T07:30:00.000Z', 'never happened (spring gap): read as 03:30 EDT'],
  ['2027-11-07T01:30', '2027-11-07T05:30:00.000Z', 'happens twice (fall overlap): the first, EDT'],
  ['2027-11-07T03:00', '2027-11-07T08:00:00.000Z', 'after fall back'],
  ['2027-03-28T02:30', '2027-03-28T06:30:00.000Z', 'Europe springs forward; New York does not move'],
  ['2027-10-31T01:30', '2027-10-31T05:30:00.000Z', 'Europe falls back; New York does not move'],
  ['2027-04-04T02:30', '2027-04-04T06:30:00.000Z', 'Sydney falls back'],
  ['2027-03-14 03:30', '2027-03-14T07:30:00.000Z', 'space separator'],
  ['2027-03-14T03:30:15', '2027-03-14T07:30:15.000Z', 'with seconds'],
  ['2027-03-14T07:00:00Z', '2027-03-14T07:00:00.000Z', 'already absolute'],
];

for (const zone of BROWSER_ZONES) {
  test(`league wall-clock strings resolve to the same instant from a browser in ${zone}`, () => {
    inBrowserZone(zone, () => {
      for (const [input, utc, why] of CASES) assert.equal(iso(input), utc, `${input} (${why})`);
    });
  });
}

test('every 2027 session time reads back as the same New York wall clock, from every browser zone', () => {
  const schedule = JSON.parse(readFileSync(new URL('../functions/scripts/data/schedule-2027.json', import.meta.url), 'utf8'));
  const times: string[] = Object.values(schedule).flatMap((ev: any) =>
    Object.values(ev).filter((v): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)));
  assert.ok(times.length > 100, 'schedule fixture went missing');

  const wallClock = new Intl.DateTimeFormat('sv-SE', {
    timeZone: LEAGUE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (const zone of BROWSER_ZONES) {
    inBrowserZone(zone, () => {
      for (const t of times) assert.equal(wallClock.format(parseLeagueDate(t)!).replace(' ', 'T'), t, `${t} from ${zone}`);
    });
  }
});

test('missing or unreadable input is null', () => {
  assert.equal(parseLeagueDate(undefined), null);
  assert.equal(parseLeagueDate(''), null);
  assert.equal(parseLeagueDate('TBA'), null);
});

test('the zone label follows the clock change', () => {
  inBrowserZone('Europe/London', () => {
    assert.equal(leagueZoneName('2027-03-14T01:30', 'short'), 'EST');
    assert.equal(leagueZoneName('2027-03-14T03:30', 'short'), 'EDT');
    assert.equal(leagueZoneName('2027-11-07T03:00', 'short'), 'EST');
  });
});
