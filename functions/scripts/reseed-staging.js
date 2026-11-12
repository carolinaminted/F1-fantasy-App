#!/usr/bin/env node
/**
 * Puts STAGING back to an active season from its archive, undoing a rehearsed rollover so the
 * rollover can be rehearsed again ([ROLL-16]). Rehearsal 1 left staging as a live 2027 season;
 * this restores 2026 from season_archives/2026, which holds every season-scoped app_state
 * document, the config as it stood when archived, the picks and the final standings.
 *
 * What it does, from the archive of --season:
 *   - season_config/current  ← archived config, status `active`, the conclusion fields removed
 *   - app_state/<id>         ← every archived state document (results, calendar, locks, ...)
 *   - userPicks              ← archived picks; live picks are deleted first
 *   - public_users/<uid>     ← archived standings (finalRank dropped) for members in the archive
 *   - season_ops/<season> and season_ops/<season+1> are deleted so the next rehearsal records fresh
 * Left alone: the archive itself (the archive step rewrites it), career_stats (derived from
 * archives), users' dues status (the archive does not hold it), maintenance.
 *
 * Staging only, twice over: the project is hardcoded, and the plan refuses unless
 * app_state/staging_seed_metadata exists, a marker that never exists in production.
 *
 *   node scripts/reseed-staging.js [--season 2026] [--apply]
 */
const STAGING_PROJECT = 'formula-fantasy-staging';
const STAGING_MARKER = 'app_state/staging_seed_metadata';
const CONCLUSION_FIELDS = ['champions', 'podium', 'finalPodium', 'p22Award', 'concludedAt'];

const readCollection = async (db, path) => {
  const snap = await db.collection(path).get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
};

/**
 * Reads staging and returns the writes that restore --season, each as
 * { path, action: 'restore' | 'delete', write }. Throws rather than return a plan that would
 * touch anything but a rehearsed rollover on staging.
 */
const planReseed = async (db, { seasonId }) => {
  const fail = (why) => { throw new Error(`cannot reseed: ${why}`); };
  if (!/^\d{4}$/.test(seasonId)) fail(`${seasonId} is not a season year`);
  const nextSeasonId = String(Number(seasonId) + 1);

  const [markerSnap, configSnap, archiveSnap] = await Promise.all([
    db.doc(STAGING_MARKER).get(),
    db.doc('season_config/current').get(),
    db.doc(`season_archives/${seasonId}`).get(),
  ]);
  if (!markerSnap.exists) fail(`${STAGING_MARKER} is missing; this is not the staging seed`);
  if (!configSnap.exists) fail('season_config/current is missing');
  const live = configSnap.data();
  if (live.activeSeasonId !== nextSeasonId) {
    fail(`active season is ${live.activeSeasonId}, not ${nextSeasonId}; only a rollover from ${seasonId} can be undone`);
  }
  if (!archiveSnap.exists) fail(`season_archives/${seasonId} is missing`);

  const state = await readCollection(db, `season_archives/${seasonId}/state`);
  for (const required of ['season_config', 'race_results', 'season_calendar']) {
    if (!(required in state)) fail(`the archive has no state/${required}`);
  }
  const { season_config: archivedConfig, ...appState } = state;
  if (archivedConfig.activeSeasonId !== seasonId) {
    fail(`the archived config is for ${archivedConfig.activeSeasonId}, not ${seasonId}`);
  }
  const config = { ...archivedConfig, status: 'active' };
  CONCLUSION_FIELDS.forEach((f) => delete config[f]);

  const [picks, standings, livePicks] = await Promise.all([
    readCollection(db, `season_archives/${seasonId}/picks`),
    readCollection(db, `season_archives/${seasonId}/standings`),
    readCollection(db, 'userPicks'),
  ]);

  const restore = (path, data) => ({ path, action: 'restore', write: () => db.doc(path).set(data) });
  const remove = (path) => ({ path, action: 'delete', write: () => db.doc(path).delete() });
  return [
    ...Object.keys(livePicks).filter((uid) => !(uid in picks)).map((uid) => remove(`userPicks/${uid}`)),
    ...Object.entries(picks).map(([uid, data]) => restore(`userPicks/${uid}`, data)),
    ...Object.entries(standings).map(([uid, { finalRank, ...data }]) => restore(`public_users/${uid}`, data)),
    ...Object.entries(appState).map(([id, data]) => restore(`app_state/${id}`, data)),
    remove(`season_ops/${seasonId}`),
    remove(`season_ops/${nextSeasonId}`),
    // Last, so a run that dies partway leaves the league in setup for the next season, not
    // active on half-restored data.
    restore('season_config/current', config),
  ];
};

const main = async () => {
  const args = process.argv.slice(2);
  const valueOf = (flag) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };
  const seasonId = valueOf('--season') || '2026';
  const apply = args.includes('--apply');
  if (args.includes('--project')) throw new Error('--project is not accepted; this script only ever targets staging');

  const { initializeApp, applicationDefault, deleteApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ credential: applicationDefault(), projectId: STAGING_PROJECT });
  try {
    const db = getFirestore(app);
    console.log(`project: ${STAGING_PROJECT}, restoring season ${seasonId} from its archive`);
    const plan = await planReseed(db, { seasonId });
    plan.forEach(({ path, action }) => console.log(`${path}: would ${action}`));
    if (!apply) {
      console.log(`dry run (${plan.length} writes); pass --apply to write.`);
      return;
    }
    for (const { path, action, write } of plan) {
      await write();
      console.log(`${path}: ${action}d`);
    }
    console.log('Done. Next: Admin > Recalculate scores, then verify.sh check against the 2026 baseline.');
  } finally {
    await deleteApp(app);
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { planReseed };
