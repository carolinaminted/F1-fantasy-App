const test = require('node:test');
const assert = require('node:assert/strict');
const { FieldPath, FieldValue } = require('firebase-admin/firestore');
const {
  BAHRAIN_SCHEDULE,
  buildMutations,
  parseArguments,
  summarise,
} = require('../scripts/fix-2026-schedule');

/**
 * The script deletes member picks, so its write plan is exercised here against a recording
 * stub rather than discovered against real data.
 */
const recordingDb = () => {
  const writes = [];
  const ref = (collection, id) => ({ collection, id });
  return {
    writes,
    collection: (collection) => ({ doc: (id) => ref(collection, id) }),
    batch: () => ({
      update: (reference, ...rest) => writes.push({ op: 'update', reference, rest }),
      set: (reference, ...rest) => writes.push({ op: 'set', reference, rest }),
    }),
  };
};

const plan = (state, options = {}) => {
  const db = recordingDb();
  const mutations = buildMutations(db, state, { dropSaudiCancellation: false, ...options });
  const batch = db.batch();
  mutations.forEach((mutation) => mutation(batch));
  return db.writes;
};

const forDocument = (writes, collection, id) => writes.filter((write) => (
  write.reference.collection === collection && write.reference.id === id
));

const fullState = () => ({
  appState: {
    race_results: {
      sau_26: { grandPrixFinish: ['ver'] },
      // The scaffold an admin creates by opening the results form and saving nothing.
      bhr_26: { grandPrixFinish: [null, null], fastestLap: null, p22Driver: null },
      aus_26: { grandPrixFinish: ['nor'] },
    },
    event_schedules: {
      sau_26: { eventId: 'sau_26', race: '2026-04-19T13:00' },
      // The April booking, including the custom lock that must not survive.
      bhr_26: { eventId: 'bhr_26', race: '2026-04-12T11:00', customLockAt: '2026-04-11T11:00' },
    },
    form_locks: { sau_26: true, bhr_26: true, aus_26: true },
    cancelled_events: {
      events: {
        sau_26: { cancelledBy: 'admin' },
        bhr_26: { cancelledBy: 'admin' },
      },
    },
  },
  userPicks: {
    alice: { aus_26: {}, sau_26: {}, bhr_26: {} },
    bob: { aus_26: {}, sau_26: {} },
    carol: { aus_26: {} },
  },
});

test('reports what is actually present', () => {
  const summary = summarise(fullState());
  assert.equal(summary.userPickDocuments, 3);
  assert.equal(summary.saudiPickDocuments, 2);
  assert.equal(summary.bahrainPickDocuments, 1);
  assert.equal(summary.saudiResults, true);
  assert.equal(summary.bahrainResults, false, 'an all-null scaffold is not a scored race');
  assert.equal(summary.saudiResultsKey, true);
  assert.equal(summary.saudiCancelled, true);
  assert.equal(summary.bahrainCancelled, true);
});

test('purges Saudi from race_results and leaves other events alone', () => {
  const [write] = forDocument(plan(fullState()), 'app_state', 'race_results');
  assert.deepEqual(write.rest[0], { sau_26: FieldValue.delete() });
});

test('replaces the Bahrain schedule outright so the April customLockAt cannot survive', () => {
  const [write] = forDocument(plan(fullState()), 'app_state', 'event_schedules');
  assert.equal(write.op, 'update', 'a merged set() would keep the stale customLockAt');
  assert.deepEqual(write.rest[0].bhr_26, BAHRAIN_SCHEDULE);
  assert.equal(write.rest[0].bhr_26.customLockAt, undefined);
  assert.deepEqual(write.rest[0].sau_26, FieldValue.delete());
});

test('the Bahrain weekend matches the published timetable', () => {
  // League time (America/New_York). Qualifying is what App.tsx turns into the picks deadline,
  // so it is pinned exactly rather than to a date prefix.
  assert.equal(BAHRAIN_SCHEDULE.fp1, '2026-10-02T00:30');
  assert.equal(BAHRAIN_SCHEDULE.fp2, '2026-10-02T04:00');
  assert.equal(BAHRAIN_SCHEDULE.fp3, '2026-10-03T00:30');
  assert.equal(BAHRAIN_SCHEDULE.qualifying, '2026-10-03T04:00');
  assert.equal(BAHRAIN_SCHEDULE.race, '2026-10-04T03:00');
  assert.ok(new Date(BAHRAIN_SCHEDULE.qualifying) < new Date(BAHRAIN_SCHEDULE.race));
});

test('clears both form locks and keeps unrelated ones', () => {
  const [write] = forDocument(plan(fullState()), 'app_state', 'form_locks');
  assert.deepEqual(Object.keys(write.rest[0]).sort(), ['bhr_26', 'sau_26']);
});

test('restores Bahrain but keeps the Saudi cancellation as a residual guard', () => {
  const writes = forDocument(plan(fullState()), 'app_state', 'cancelled_events');
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].rest[0], new FieldPath('events', 'bhr_26'));
  assert.deepEqual(writes[0].rest[1], FieldValue.delete());
});

test('--drop-saudi-cancellation removes the Saudi entry too', () => {
  const writes = forDocument(
    plan(fullState(), { dropSaudiCancellation: true }),
    'app_state',
    'cancelled_events',
  );
  assert.equal(writes.length, 2);
});

test('touches only the userPicks documents that hold the two events', () => {
  const writes = plan(fullState()).filter((write) => write.reference.collection === 'userPicks');
  assert.deepEqual(writes.map((write) => write.reference.id), ['alice', 'bob']);
  assert.deepEqual(Object.keys(writes[0].rest[0]).sort(), ['bhr_26', 'sau_26']);
  assert.deepEqual(Object.keys(writes[1].rest[0]), ['sau_26']);
});

test('a settled Bahrain schedule does not stop the rest of the work', () => {
  const state = fullState();
  state.appState.event_schedules = { bhr_26: BAHRAIN_SCHEDULE };
  const writes = plan(state);
  const targets = writes.map((write) => `${write.reference.collection}/${write.reference.id}`);
  assert.ok(!targets.includes('app_state/event_schedules'), 'schedule is already correct');
  assert.ok(targets.includes('app_state/cancelled_events'), 'Bahrain must still be restored');
  assert.ok(targets.includes('app_state/form_locks'));
  assert.ok(targets.includes('userPicks/alice'));
  assert.ok(targets.includes('app_state/race_results'));
});

test('is a no-op once everything has been applied', () => {
  const writes = plan({
    appState: {
      race_results: { aus_26: {} },
      event_schedules: { bhr_26: BAHRAIN_SCHEDULE },
      form_locks: { aus_26: true },
      cancelled_events: { events: { sau_26: { cancelledBy: 'admin' } } },
    },
    userPicks: { alice: { aus_26: {} } },
  });
  assert.deepEqual(writes, []);
});

test('requires a project and refuses production without the explicit flag', () => {
  assert.throws(() => parseArguments([]), /Pass --project/);
  assert.throws(
    () => parseArguments(['--project', 'formula-fantasy-1']),
    /--allow-production/,
  );
  assert.deepEqual(parseArguments(['--project', 'formula-fantasy-staging', '--apply']), {
    apply: true,
    project: 'formula-fantasy-staging',
    dropSaudiCancellation: false,
  });
});
