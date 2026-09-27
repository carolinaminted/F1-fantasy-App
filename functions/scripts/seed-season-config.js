#!/usr/bin/env node
/**
 * Writes `season_config/current`, the list of events that score.
 *
 * The ids come from `EVENTS` in the repo-root `constants.ts` until [ROLL-02] moves the calendar
 * into Firestore. Rules forbid every client write to this document, so this script (Admin SDK)
 * is the only way it changes.
 *
 * Dry run by default. Staging is the only permitted target unless --allow-production is passed,
 * which needs the per-action approval described in ../../CLAUDE.md. It refuses to overwrite a
 * document that differs from what it would write, so it cannot silently change a live list.
 *
 *   node scripts/seed-season-config.js --project formula-fantasy-staging [--apply]
 */
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { parseScoredEventIds } = require('../season-config');

const STAGING_PROJECT = 'formula-fantasy-staging';
const PRODUCTION_PROJECT = 'formula-fantasy-1';

const buildSeasonConfig = (constantsSource) => {
  const events = constantsSource.match(/export const EVENTS: Event\[\] = \[([\s\S]*?)\n\];/);
  if (!events) throw new Error('could not locate the EVENTS array in constants.ts');
  const scoredEventIds = [...events[1].matchAll(/\bid:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
  const config = { activeSeasonId: '2026', label: '2026 Season', status: 'active', scoredEventIds };
  parseScoredEventIds({ exists: true, data: () => config });
  return config;
};

const main = async () => {
  const args = process.argv.slice(2);
  const projectIndex = args.indexOf('--project');
  const project = projectIndex === -1 ? undefined : args[projectIndex + 1];
  const apply = args.includes('--apply');
  if (!project) throw new Error('--project is required');
  if (project === PRODUCTION_PROJECT && !args.includes('--allow-production')) {
    throw new Error(`${PRODUCTION_PROJECT} needs --allow-production and per-action approval`);
  }
  if (project !== STAGING_PROJECT && project !== PRODUCTION_PROJECT) {
    throw new Error(`unknown project ${project}`);
  }

  const { initializeApp, applicationDefault, deleteApp } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  const app = initializeApp({ credential: applicationDefault(), projectId: project });
  try {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'constants.ts'), 'utf8');
    const config = buildSeasonConfig(source);
    const ref = getFirestore(app).collection('season_config').doc('current');
    const existing = await ref.get();

    console.log(`project: ${project}`);
    console.log(`would write: ${JSON.stringify(config)}`);
    if (existing.exists) {
      if (isDeepStrictEqual(existing.data(), config)) {
        console.log('already current; nothing to do.');
        return;
      }
      throw new Error(`season_config/current already exists and differs: ${JSON.stringify(existing.data())}`);
    }
    if (!apply) {
      console.log('dry run; pass --apply to write.');
      return;
    }
    // create() rather than set(): fails if the doc appeared since the read above.
    await ref.create(config);
    console.log('written.');
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

module.exports = { buildSeasonConfig };
