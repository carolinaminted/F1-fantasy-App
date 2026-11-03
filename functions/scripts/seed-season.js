#!/usr/bin/env node
/**
 * Writes the two documents that define a season: `season_config/current` (which events score,
 * and the season's id and label) and `app_state/season_calendar` (what members see). Both come
 * from one data file, so the scored list and the displayed calendar cannot drift.
 *
 * Round 16 of 2026 is Bahrain's race run at Sepang. The `bhr_26` id is deliberately reused, so
 * existing schedule, lock and admin-log records follow the event.
 *
 * Dry run by default. Staging is the only permitted target unless --allow-production is passed,
 * which needs the per-action approval described in ../../CLAUDE.md. Each document is created if
 * absent, left alone if identical, and the run refuses if either exists and differs — so it can
 * never silently change a live season.
 *
 * --calendar-only is the one exception, for the season rollover ([ROLL-15]): after Start new
 * season, season_config/current is `setup` for the next season but app_state/season_calendar still
 * holds the old one. In that state, and only that state, this mode overwrites the calendar from the
 * data file and leaves the config alone; Open season then derives scoredEventIds from it.
 *
 * Session times are a separate step either way: paste data/schedule-<year>.json into
 * Admin > Schedule's importer, which writes app_state/event_schedules.
 *
 *   node scripts/seed-season.js --project formula-fantasy-staging [--season 2026] [--apply]
 *   node scripts/seed-season.js --project formula-fantasy-staging --season 2027 --calendar-only [--apply]
 */
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { parseScoredEventIds } = require('../season-config');

const STAGING_PROJECT = 'formula-fantasy-staging';
const PRODUCTION_PROJECT = 'formula-fantasy-1';

const buildSeasonDocs = (season) => {
  const { seasonId, label, events } = season;
  if (!Array.isArray(events) || events.length === 0) throw new Error('season has no events');
  const ids = events.map((e) => e.id);
  if (new Set(ids).size !== ids.length) throw new Error('season has a duplicate event id');
  events.forEach((e, i) => {
    if (e.round !== i + 1) throw new Error(`event ${e.id} has round ${e.round}, expected ${i + 1}`);
  });
  const calendarEvents = events.map(({ id, round, name, country, location, circuit, hasSprint }) => (
    { id, round, name, country, location, circuit, hasSprint }
  ));
  const config = { activeSeasonId: seasonId, label, status: 'active', scoredEventIds: ids };
  parseScoredEventIds({ exists: true, data: () => config });
  return { config, calendar: { seasonId, events: calendarEvents } };
};

/**
 * Reads the live documents and returns the writes the seed needs, each as
 * { path, action: 'create' | 'overwrite', write }. Throws rather than returning a plan that would
 * change a live season.
 */
const planSeed = async (db, { config, calendar }, { calendarOnly }) => {
  const configRef = db.doc('season_config/current');
  const calendarRef = db.doc('app_state/season_calendar');
  const targets = [];
  if (calendarOnly) {
    const existing = await configRef.get();
    if (!existing.exists) throw new Error(`${configRef.path} is missing; --calendar-only needs a season in setup`);
    const { activeSeasonId, status } = existing.data();
    if (activeSeasonId !== calendar.seasonId) {
      throw new Error(`${configRef.path} is for ${activeSeasonId}, not ${calendar.seasonId}; refusing to write its calendar`);
    }
    if (status !== 'setup') throw new Error(`${configRef.path} status is ${status}, not setup; refusing to overwrite the calendar`);
    targets.push({ ref: calendarRef, data: calendar, overwrite: true });
  } else {
    targets.push({ ref: configRef, data: config, overwrite: false }, { ref: calendarRef, data: calendar, overwrite: false });
  }

  const pending = [];
  for (const { ref, data, overwrite } of targets) {
    const existing = await ref.get();
    if (!existing.exists) {
      // create() rather than set(): fails if a document appeared since this read.
      pending.push({ path: ref.path, action: 'create', write: () => ref.create(data) });
    } else if (isDeepStrictEqual(existing.data(), data)) {
      continue;
    } else if (overwrite) {
      pending.push({ path: ref.path, action: 'overwrite', write: () => ref.set(data) });
    } else {
      throw new Error(`${ref.path} already exists and differs; refusing to overwrite`);
    }
  }
  return pending;
};

const main = async () => {
  const args = process.argv.slice(2);
  const valueOf = (flag) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };
  const project = valueOf('--project');
  const seasonId = valueOf('--season') || '2026';
  const apply = args.includes('--apply');
  const calendarOnly = args.includes('--calendar-only');
  if (!project) throw new Error('--project is required');
  if (project === PRODUCTION_PROJECT && !args.includes('--allow-production')) {
    throw new Error(`${PRODUCTION_PROJECT} needs --allow-production and per-action approval`);
  }
  if (project !== STAGING_PROJECT && project !== PRODUCTION_PROJECT) {
    throw new Error(`unknown project ${project}`);
  }

  const docs = buildSeasonDocs(require(path.join(__dirname, 'data', `season-${seasonId}.json`)));

  const { initializeApp, applicationDefault, deleteApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ credential: applicationDefault(), projectId: project });
  try {
    const db = getFirestore(app);
    console.log(`project: ${project}, season: ${seasonId}${calendarOnly ? ', calendar only' : ''}`);
    const pending = await planSeed(db, docs, { calendarOnly });
    if (pending.length === 0) {
      console.log('both documents already current');
      return;
    }
    pending.forEach(({ path: docPath, action }) => console.log(`${docPath}: would ${action}`));
    if (!apply) {
      console.log('dry run; pass --apply to write.');
      return;
    }
    for (const { path: docPath, write } of pending) {
      await write();
      console.log(`${docPath}: written`);
    }
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

module.exports = { buildSeasonDocs, planSeed };
