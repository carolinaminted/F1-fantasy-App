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
 *   node scripts/seed-season.js --project formula-fantasy-staging [--season 2026] [--apply]
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

const main = async () => {
  const args = process.argv.slice(2);
  const valueOf = (flag) => {
    const i = args.indexOf(flag);
    return i === -1 ? undefined : args[i + 1];
  };
  const project = valueOf('--project');
  const seasonId = valueOf('--season') || '2026';
  const apply = args.includes('--apply');
  if (!project) throw new Error('--project is required');
  if (project === PRODUCTION_PROJECT && !args.includes('--allow-production')) {
    throw new Error(`${PRODUCTION_PROJECT} needs --allow-production and per-action approval`);
  }
  if (project !== STAGING_PROJECT && project !== PRODUCTION_PROJECT) {
    throw new Error(`unknown project ${project}`);
  }

  const { config, calendar } = buildSeasonDocs(require(path.join(__dirname, 'data', `season-${seasonId}.json`)));

  const { initializeApp, applicationDefault, deleteApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ credential: applicationDefault(), projectId: project });
  try {
    const db = getFirestore(app);
    const targets = [
      { ref: db.collection('season_config').doc('current'), data: config },
      { ref: db.collection('app_state').doc('season_calendar'), data: calendar },
    ];
    console.log(`project: ${project}, season: ${seasonId}`);
    const pending = [];
    for (const { ref, data } of targets) {
      const existing = await ref.get();
      if (!existing.exists) {
        pending.push({ ref, data });
        console.log(`${ref.path}: would create`);
      } else if (isDeepStrictEqual(existing.data(), data)) {
        console.log(`${ref.path}: already current`);
      } else {
        throw new Error(`${ref.path} already exists and differs; refusing to overwrite`);
      }
    }
    if (pending.length === 0) return;
    if (!apply) {
      console.log('dry run; pass --apply to write.');
      return;
    }
    // create() rather than set(): fails if a document appeared since the reads above.
    for (const { ref, data } of pending) {
      await ref.create(data);
      console.log(`${ref.path}: written`);
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

module.exports = { buildSeasonDocs };
