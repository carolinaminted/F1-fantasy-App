#!/usr/bin/env node

/**
 * One-off 2026 calendar correction.
 *
 * Bahrain moved from its cancelled April slot to Round 16 at Sepang (2-4 October) and Saudi
 * Arabia left the calendar altogether. `constants.ts` covers what members see; this script
 * covers what Firestore still holds, which the code change alone cannot reach.
 *
 *   Saudi  — purge `sau_26` from race_results, event_schedules, form_locks and every
 *            userPicks document. The cancellation entry is deliberately KEPT as a residual
 *            guard unless --drop-saudi-cancellation is passed.
 *   Bahrain — restore the event (delete its cancellation entry), clear the stale April picks
 *            and form lock, and write provisional Sepang session times.
 *
 * Dry run by default: it always takes a backup and prints a report, and writes nothing until
 * --apply. Staging is the only permitted target unless --allow-production is passed, which
 * exists for the production cutover and requires the per-action approval described in
 * ../../CLAUDE.md.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  applicationDefault,
  deleteApp,
  initializeApp,
} = require('firebase-admin/app');
const {
  FieldPath,
  FieldValue,
  getFirestore,
} = require('firebase-admin/firestore');

const STAGING_PROJECT = 'formula-fantasy-staging';
const PRODUCTION_PROJECT = 'formula-fantasy-1';
const REMOVED_EVENT_ID = 'sau_26';
const MOVED_EVENT_ID = 'bhr_26';
const BACKUP_DIRECTORY = path.join(__dirname, '..', '..', '.backups');
const APP_STATE_DOCUMENTS = [
  'race_results',
  'event_schedules',
  'form_locks',
  'cancelled_events',
];
const BATCH_LIMIT = 400;

/**
 * Provisional. Sepang runs at UTC+8 and these are stored in league time (America/New_York,
 * UTC-4 on this weekend), so each is the local session minus twelve hours. Correct them in
 * Admin -> Race Schedule once the official timetable is published: an in-the-past qualifying
 * time makes PicksForm treat the race as locked and members cannot enter picks.
 */
const BAHRAIN_SCHEDULE = {
  eventId: MOVED_EVENT_ID,
  name: 'Bahrain GP',
  hasSprint: false,
  fp1: '2026-10-02T03:00',
  fp2: '2026-10-02T07:00',
  fp3: '2026-10-03T03:00',
  qualifying: '2026-10-03T06:00',
  race: '2026-10-04T03:00',
};

const parseArguments = (argv) => {
  const supported = new Set([
    '--apply',
    '--project',
    '--drop-saudi-cancellation',
    '--allow-production',
  ]);
  let apply = false;
  let project;
  let dropSaudiCancellation = false;
  let allowProduction = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--apply') {
      apply = true;
      continue;
    }

    if (argument === '--drop-saudi-cancellation') {
      dropSaudiCancellation = true;
      continue;
    }

    if (argument === '--allow-production') {
      allowProduction = true;
      continue;
    }

    if (argument === '--project') {
      project = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith('--project=')) {
      project = argument.slice('--project='.length);
      continue;
    }

    const optionName = argument.split('=')[0];
    if (!supported.has(optionName)) {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }

  if (!project) {
    throw new Error('Pass --project <firebase project id>. There is no default.');
  }

  if (project === PRODUCTION_PROJECT && !allowProduction) {
    throw new Error(
      `Refusing to touch "${PRODUCTION_PROJECT}" without --allow-production. ` +
      'Production changes need explicit per-action approval; see CLAUDE.md.',
    );
  }

  if (project !== STAGING_PROJECT && project !== PRODUCTION_PROJECT) {
    throw new Error(
      `Unknown project "${project}". Expected "${STAGING_PROJECT}" or "${PRODUCTION_PROJECT}".`,
    );
  }

  return { apply, project, dropSaudiCancellation };
};

const readState = async (db) => {
  const appStateSnapshots = await db.getAll(
    ...APP_STATE_DOCUMENTS.map((id) => db.collection('app_state').doc(id)),
  );
  const appState = Object.fromEntries(appStateSnapshots.map((snapshot, index) => [
    APP_STATE_DOCUMENTS[index],
    snapshot.exists ? snapshot.data() : null,
  ]));

  const picksSnapshot = await db.collection('userPicks').get();
  const userPicks = Object.fromEntries(
    picksSnapshot.docs.map((document) => [document.id, document.data()]),
  );

  return { appState, userPicks };
};

/**
 * Written before anything else and the only way back from the purge, so a failure here aborts
 * the run rather than being reported and stepped over.
 */
const writeBackup = (project, state) => {
  fs.mkdirSync(BACKUP_DIRECTORY, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(BACKUP_DIRECTORY, `schedule-correction-${project}-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ project, capturedAt: stamp, ...state }, null, 2));
  return file;
};

const hasContent = (value) => !!value && Object.keys(value).length > 0;

/**
 * Mirrors `hasEventResults` in utils/eventStatus.ts. A results document is scaffolded with null
 * placeholders as soon as an admin opens the form, so "the key exists" is not the same as
 * "this race was scored" — and only the latter should ever hold up a decision to delete.
 */
const hasRealResults = (result) => {
  if (!result) return false;
  const anyOf = (key) => Array.isArray(result[key]) && result[key].some((entry) => !!entry);
  return anyOf('grandPrixFinish')
    || !!result.fastestLap
    || anyOf('sprintFinish')
    || anyOf('gpQualifying')
    || anyOf('sprintQualifying');
};

const summarise = (state) => {
  const { appState, userPicks } = state;
  const entries = Object.entries(userPicks);
  const count = (eventId) => entries.filter(([, picks]) => picks[eventId] !== undefined).length;
  const cancelled = appState.cancelled_events?.events || {};

  return {
    userPickDocuments: entries.length,
    saudiPickDocuments: count(REMOVED_EVENT_ID),
    bahrainPickDocuments: count(MOVED_EVENT_ID),
    saudiResultsKey: appState.race_results?.[REMOVED_EVENT_ID] !== undefined,
    saudiResults: hasRealResults(appState.race_results?.[REMOVED_EVENT_ID]),
    bahrainResults: hasRealResults(appState.race_results?.[MOVED_EVENT_ID]),
    saudiSchedule: hasContent(appState.event_schedules?.[REMOVED_EVENT_ID]),
    bahrainSchedule: appState.event_schedules?.[MOVED_EVENT_ID] || null,
    saudiFormLock: appState.form_locks?.[REMOVED_EVENT_ID],
    bahrainFormLock: appState.form_locks?.[MOVED_EVENT_ID],
    saudiCancelled: cancelled[REMOVED_EVENT_ID] !== undefined,
    bahrainCancelled: cancelled[MOVED_EVENT_ID] !== undefined,
  };
};

const printReport = (project, summary, backupFile, options) => {
  const yesNo = (value) => (value ? 'yes' : 'no');

  console.log(`\nProject: ${project}`);
  console.log(`Backup:  ${backupFile}`);
  console.log('\n--- What is in Firestore now ---');
  console.log(`userPicks documents:              ${summary.userPickDocuments}`);
  console.log(`  containing ${REMOVED_EVENT_ID} (Saudi):       ${summary.saudiPickDocuments}`);
  console.log(`  containing ${MOVED_EVENT_ID} (Bahrain):     ${summary.bahrainPickDocuments}`);
  console.log(`race_results.${REMOVED_EVENT_ID} scored:         ${yesNo(summary.saudiResults)}` +
    `${summary.saudiResultsKey && !summary.saudiResults ? ' (empty scaffold)' : ''}`);
  console.log(`race_results.${MOVED_EVENT_ID} scored:         ${yesNo(summary.bahrainResults)}`);
  if (summary.bahrainResults) {
    console.log('  !! Bahrain already holds real results from its April slot. classifyEvent');
    console.log('     ranks results above the calendar, so the October race would show as');
    console.log('     completed. Clear them in Admin -> Race Results before restoring.');
  }
  console.log(`event_schedules.${REMOVED_EVENT_ID} present:     ${yesNo(summary.saudiSchedule)}`);
  console.log(`event_schedules.${MOVED_EVENT_ID} present:     ${yesNo(!!summary.bahrainSchedule)}`);
  if (summary.bahrainSchedule) {
    console.log(`  current Bahrain race time:      ${summary.bahrainSchedule.race || '(unset)'}`);
    console.log(`  current Bahrain qualifying:     ${summary.bahrainSchedule.qualifying || '(unset)'}`);
    if (summary.bahrainSchedule.customLockAt) {
      console.log(`  current Bahrain customLockAt:   ${summary.bahrainSchedule.customLockAt} (will be dropped)`);
    }
  }
  console.log(`form_locks.${REMOVED_EVENT_ID}:                  ${summary.saudiFormLock ?? '(unset)'}`);
  console.log(`form_locks.${MOVED_EVENT_ID}:                  ${summary.bahrainFormLock ?? '(unset)'}`);
  console.log(`cancelled: ${REMOVED_EVENT_ID}=${yesNo(summary.saudiCancelled)}  ${MOVED_EVENT_ID}=${yesNo(summary.bahrainCancelled)}`);

  console.log('\n--- What will change ---');
  console.log(`Saudi   : purge ${REMOVED_EVENT_ID} from race_results, event_schedules, form_locks`);
  console.log(`          and from ${summary.saudiPickDocuments} userPicks document(s)`);
  console.log(options.dropSaudiCancellation
    ? '          and drop its cancellation entry (--drop-saudi-cancellation)'
    : '          cancellation entry KEPT as a residual guard');
  console.log(`Bahrain : restore (delete cancellation entry), clear form lock,`);
  console.log(`          clear ${MOVED_EVENT_ID} from ${summary.bahrainPickDocuments} userPicks document(s),`);
  console.log(`          replace event_schedules.${MOVED_EVENT_ID} with PROVISIONAL Sepang times:`);
  console.log(`            qualifying ${BAHRAIN_SCHEDULE.qualifying}   race ${BAHRAIN_SCHEDULE.race}  (league time)`);
};

const commit = async (db, mutations) => {
  for (let index = 0; index < mutations.length; index += BATCH_LIMIT) {
    const batch = db.batch();
    mutations.slice(index, index + BATCH_LIMIT).forEach((mutation) => mutation(batch));
    await batch.commit();
  }
};

const buildMutations = (db, state, options) => {
  const { appState, userPicks } = state;
  const mutations = [];
  const appStateRef = (id) => db.collection('app_state').doc(id);

  if (appState.race_results?.[REMOVED_EVENT_ID] !== undefined) {
    mutations.push((batch) => batch.update(appStateRef('race_results'), {
      [REMOVED_EVENT_ID]: FieldValue.delete(),
    }));
  }

  if (appState.event_schedules) {
    const update = {};
    // Skipped when it already matches, so a repeat run settles on "0 writes planned" and an
    // operator can tell "already applied" from "not applied yet".
    const current = appState.event_schedules[MOVED_EVENT_ID];
    if (JSON.stringify(current) !== JSON.stringify(BAHRAIN_SCHEDULE)) {
      update[MOVED_EVENT_ID] = BAHRAIN_SCHEDULE;
    }
    if (appState.event_schedules[REMOVED_EVENT_ID] !== undefined) {
      update[REMOVED_EVENT_ID] = FieldValue.delete();
    }
    if (Object.keys(update).length > 0) {
      // update() replaces the whole bhr_26 map. A merged set() would leave the April
      // customLockAt in place, and customLockAt outranks qualifying when App.tsx derives the
      // picks deadline — the race would lock the moment it appeared.
      mutations.push((batch) => batch.update(appStateRef('event_schedules'), update));
    }
  } else {
    mutations.push((batch) => batch.set(appStateRef('event_schedules'), {
      [MOVED_EVENT_ID]: BAHRAIN_SCHEDULE,
    }, { merge: true }));
  }

  if (appState.form_locks) {
    const update = {};
    if (appState.form_locks[REMOVED_EVENT_ID] !== undefined) {
      update[REMOVED_EVENT_ID] = FieldValue.delete();
    }
    if (appState.form_locks[MOVED_EVENT_ID] !== undefined) {
      update[MOVED_EVENT_ID] = FieldValue.delete();
    }
    if (Object.keys(update).length > 0) {
      mutations.push((batch) => batch.update(appStateRef('form_locks'), update));
    }
  }

  const cancelled = appState.cancelled_events?.events || {};
  if (cancelled[MOVED_EVENT_ID] !== undefined) {
    mutations.push((batch) => batch.update(
      appStateRef('cancelled_events'),
      new FieldPath('events', MOVED_EVENT_ID),
      FieldValue.delete(),
    ));
  }
  if (options.dropSaudiCancellation && cancelled[REMOVED_EVENT_ID] !== undefined) {
    mutations.push((batch) => batch.update(
      appStateRef('cancelled_events'),
      new FieldPath('events', REMOVED_EVENT_ID),
      FieldValue.delete(),
    ));
  }

  Object.entries(userPicks).forEach(([userId, picks]) => {
    const update = {};
    if (picks[REMOVED_EVENT_ID] !== undefined) update[REMOVED_EVENT_ID] = FieldValue.delete();
    if (picks[MOVED_EVENT_ID] !== undefined) update[MOVED_EVENT_ID] = FieldValue.delete();
    if (Object.keys(update).length > 0) {
      mutations.push((batch) => batch.update(db.collection('userPicks').doc(userId), update));
    }
  });

  return mutations;
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: options.project,
  }, 'schedule-correction');

  try {
    const db = getFirestore(app);
    const state = await readState(db);
    const backupFile = writeBackup(options.project, state);
    printReport(options.project, summarise(state), backupFile, options);

    const mutations = buildMutations(db, state, options);

    if (!options.apply) {
      console.log(`\nDry run only. ${mutations.length} write(s) planned.`);
      console.log('Re-run with --apply to write them.');
      return;
    }

    await commit(db, mutations);
    console.log(`\nApplied ${mutations.length} write(s).`);
    console.log(
      'The writes to race_results and cancelled_events fire updateLeaderboardOnResults and\n' +
      'updateLeaderboardOnCancellation, which rebuild public_users. Confirm the leaderboard\n' +
      'settled before signing off — the client trusts that cache on its fast path.',
    );
    console.log(
      `\nBahrain's session times are PROVISIONAL. Set the real ones in Admin -> Race Schedule.`,
    );
  } finally {
    await deleteApp(app);
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(`Schedule correction failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  BAHRAIN_SCHEDULE,
  buildMutations,
  parseArguments,
  summarise,
};
