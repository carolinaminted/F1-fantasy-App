import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unmetPreconditions, type Precondition, type StagingState } from './preconditions.ts';

const good: StagingState = {
  season: { status: 'active' },
  calendar: { events: [{ id: 'bhr_27' }] },
  maintenance: { enabled: false },
  member: { duesPaidStatus: 'Unpaid' },
  admin: { isAdmin: true },
};
const all: Precondition[] = ['maintenance-off', 'calendar-present', 'season-active', 'member-is-not-admin', 'member-dues-unpaid', 'admin-is-admin'];
const names = (unmet: string[]) => unmet.map((u) => u.split(':')[0]);

test('a ready staging has nothing unmet, with or without a maintenance doc', () => {
  assert.deepEqual(unmetPreconditions(all, good), []);
  assert.deepEqual(unmetPreconditions(all, { ...good, maintenance: null }), []);
  // The app reads a missing duesPaidStatus as Unpaid (services/firestoreService.ts).
  assert.deepEqual(unmetPreconditions(all, { ...good, member: {} }), []);
});

test('each unmet precondition is named with what is wrong', () => {
  const broken: StagingState = {
    season: { status: 'archived' }, calendar: { events: [] }, maintenance: { enabled: true },
    member: { isAdmin: true, duesPaidStatus: 'Paid' }, admin: {},
  };
  const unmet = unmetPreconditions(all, broken);
  assert.deepEqual(names(unmet), all);
  assert.match(unmet[2], /status is "archived", expected "active"/);
});

test('missing documents are unmet, not crashes', () => {
  const empty: StagingState = { season: null, calendar: null, maintenance: null, member: null, admin: null };
  assert.deepEqual(names(unmetPreconditions(all, empty)), all.filter((n) => n !== 'maintenance-off'));
});

test('only the requested preconditions are checked', () => {
  assert.deepEqual(unmetPreconditions(['calendar-present'], { ...good, season: null }), []);
});
