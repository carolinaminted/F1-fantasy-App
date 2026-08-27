#!/usr/bin/env node

const crypto = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const {
  applicationDefault,
  deleteApp,
  initializeApp,
} = require('firebase-admin/app');
const {
  FieldValue,
  getFirestore,
} = require('firebase-admin/firestore');

const SOURCE_PROJECT = 'formula-fantasy-1';
const TARGET_PROJECT = 'formula-fantasy-staging';
const SEED_VERSION = 1;
const INVITATION_COUNT = 5;
const METADATA_PATH = 'app_state/staging_seed_metadata';
const EXCLUDED_COLLECTIONS = [
  'users',
  'public_users',
  'userPicks',
  'dues_payments',
  'admin_logs',
];

const COPIED_APP_STATE_DOCUMENTS = [
  'race_results',
  'scoring_config',
  'entities',
  'event_schedules',
  'league_config',
];

const SYNTHETIC_APP_STATE_DOCUMENTS = {
  form_locks: {},
  cancelled_events: { events: {} },
  maintenance: { enabled: false, message: null },
  results_announcement: { active: false },
  general_announcement: { active: false },
};

const parseArguments = (argv) => {
  const supported = new Set(['--apply', '--project', '--verify']);
  let apply = false;
  let project;
  let verify = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--apply') {
      apply = true;
      continue;
    }

    if (argument === '--verify') {
      verify = true;
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

  if (project !== TARGET_PROJECT) {
    throw new Error(
      `Refusing to seed project "${project || '(missing)'}". ` +
      `The only permitted target is "${TARGET_PROJECT}".`,
    );
  }

  if (apply && verify) {
    throw new Error('Choose either --apply or --verify, not both.');
  }

  return { apply, project, verify };
};

const randomSegment = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(
    { length: 4 },
    () => alphabet[crypto.randomInt(0, alphabet.length)],
  ).join('');
};

const generateInvitationCode = () => `LOL-${randomSegment()}-${randomSegment()}`;

const fieldCount = (data) => Object.keys(data || {}).length;

const loadSourceDocuments = async (sourceDb) => {
  const references = COPIED_APP_STATE_DOCUMENTS.map((documentId) => (
    sourceDb.collection('app_state').doc(documentId)
  ));
  const snapshots = await sourceDb.getAll(...references);

  return Object.fromEntries(snapshots.map((snapshot, index) => {
    const documentId = COPIED_APP_STATE_DOCUMENTS[index];
    if (!snapshot.exists) {
      throw new Error(
        `Required production source document is missing: app_state/${documentId}`,
      );
    }
    return [documentId, snapshot.data()];
  }));
};

const planInvitationCodes = async (targetDb) => {
  const metadataSnapshot = await targetDb.doc(METADATA_PATH).get();
  const recordedCodes = metadataSnapshot.exists
    ? metadataSnapshot.data().invitationCodes
    : [];
  const codes = Array.isArray(recordedCodes)
    ? recordedCodes.filter((code) => typeof code === 'string')
    : [];
  const uniqueCodes = [...new Set(codes)].slice(0, INVITATION_COUNT);

  while (uniqueCodes.length < INVITATION_COUNT) {
    const candidate = generateInvitationCode();
    if (!uniqueCodes.includes(candidate)) uniqueCodes.push(candidate);
  }

  const snapshots = await targetDb.getAll(
    ...uniqueCodes.map((code) => targetDb.collection('invitation_codes').doc(code)),
  );

  return {
    codes: uniqueCodes,
    existingCount: snapshots.filter((snapshot) => snapshot.exists).length,
    missingCodes: snapshots
      .filter((snapshot) => !snapshot.exists)
      .map((snapshot) => snapshot.id),
  };
};

const printPlan = ({ apply, verify, sourceDocuments, invitationPlan }) => {
  const mode = apply ? 'APPLY' : verify ? 'VERIFY' : 'DRY RUN';
  console.log(`Mode: ${mode}`);
  console.log(`Source project: ${SOURCE_PROJECT} (read-only)`);
  console.log(`Target project: ${TARGET_PROJECT}`);
  console.log('Production documents approved for copying:');
  for (const documentId of COPIED_APP_STATE_DOCUMENTS) {
    console.log(
      `  app_state/${documentId} (${fieldCount(sourceDocuments[documentId])} top-level fields)`,
    );
  }
  console.log('Synthetic staging documents:');
  for (const documentId of Object.keys(SYNTHETIC_APP_STATE_DOCUMENTS)) {
    console.log(`  app_state/${documentId}`);
  }
  console.log(
    `Invitation codes: ${INVITATION_COUNT} total; ` +
    `${invitationPlan.existingCount} already exist; ` +
    `${invitationPlan.missingCodes.length} would be created`,
  );
  console.log(`Excluded collections: ${EXCLUDED_COLLECTIONS.join(', ')}`);
};

const applySeed = async ({ targetDb, sourceDocuments, invitationPlan }) => {
  const batch = targetDb.batch();

  for (const [documentId, data] of Object.entries(sourceDocuments)) {
    batch.set(targetDb.collection('app_state').doc(documentId), data);
  }

  for (const [documentId, data] of Object.entries(SYNTHETIC_APP_STATE_DOCUMENTS)) {
    batch.set(targetDb.collection('app_state').doc(documentId), data);
  }

  for (const code of invitationPlan.missingCodes) {
    batch.set(targetDb.collection('invitation_codes').doc(code), {
      code,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: 'staging-seed-script',
    });
  }

  batch.set(targetDb.doc(METADATA_PATH), {
    seedVersion: SEED_VERSION,
    sourceProject: SOURCE_PROJECT,
    targetProject: TARGET_PROJECT,
    copiedDocuments: COPIED_APP_STATE_DOCUMENTS,
    syntheticDocuments: Object.keys(SYNTHETIC_APP_STATE_DOCUMENTS),
    invitationCodes: invitationPlan.codes,
    invitationCount: invitationPlan.codes.length,
    seededAt: FieldValue.serverTimestamp(),
  });

  await batch.commit();
  console.log(
    `Seed complete: ${Object.keys(sourceDocuments).length + Object.keys(SYNTHETIC_APP_STATE_DOCUMENTS).length + 1} ` +
    `app_state documents and ${invitationPlan.codes.length} invitation codes are present.`,
  );
  console.log('Invitation-code values are intentionally not printed. View them in the staging Firebase console.');
};

const verifySeed = async ({ targetDb, sourceDocuments, invitationPlan }) => {
  const copiedSnapshots = await targetDb.getAll(
    ...COPIED_APP_STATE_DOCUMENTS.map((documentId) => (
      targetDb.collection('app_state').doc(documentId)
    )),
  );
  const syntheticSnapshots = await targetDb.getAll(
    ...Object.keys(SYNTHETIC_APP_STATE_DOCUMENTS).map((documentId) => (
      targetDb.collection('app_state').doc(documentId)
    )),
  );
  const metadataSnapshot = await targetDb.doc(METADATA_PATH).get();
  const invitationSnapshots = await targetDb.getAll(
    ...invitationPlan.codes.map((code) => targetDb.collection('invitation_codes').doc(code)),
  );
  const excludedCounts = Object.fromEntries(await Promise.all(
    EXCLUDED_COLLECTIONS.map(async (collectionName) => {
      const snapshot = await targetDb.collection(collectionName).count().get();
      return [collectionName, snapshot.data().count];
    }),
  ));

  const copiedMismatches = copiedSnapshots
    .filter((snapshot) => (
      !snapshot.exists ||
      !isDeepStrictEqual(snapshot.data(), sourceDocuments[snapshot.id])
    ))
    .map((snapshot) => snapshot.id);
  const syntheticMismatches = syntheticSnapshots
    .filter((snapshot) => (
      !snapshot.exists ||
      !isDeepStrictEqual(snapshot.data(), SYNTHETIC_APP_STATE_DOCUMENTS[snapshot.id])
    ))
    .map((snapshot) => snapshot.id);
  const invitationMismatches = invitationSnapshots
    .filter((snapshot) => {
      if (!snapshot.exists) return true;
      const data = snapshot.data();
      return data.code !== snapshot.id || !['active', 'reserved', 'used'].includes(data.status);
    })
    .map((snapshot) => snapshot.id);
  const metadata = metadataSnapshot.exists ? metadataSnapshot.data() : {};
  const metadataValid = (
    metadata.seedVersion === SEED_VERSION &&
    metadata.sourceProject === SOURCE_PROJECT &&
    metadata.targetProject === TARGET_PROJECT &&
    Array.isArray(metadata.invitationCodes) &&
    metadata.invitationCodes.length === INVITATION_COUNT
  );

  if (
    copiedMismatches.length ||
    syntheticMismatches.length ||
    invitationMismatches.length ||
    !metadataValid
  ) {
    throw new Error(
      'Seed verification failed: ' +
      `copied mismatches=${copiedMismatches.join(',') || 'none'}; ` +
      `synthetic mismatches=${syntheticMismatches.join(',') || 'none'}; ` +
      `invitation mismatches=${invitationMismatches.length}; ` +
      `metadata valid=${metadataValid}`,
    );
  }

  console.log(
    `Verification passed: ${copiedSnapshots.length} copied documents match production, ` +
    `${syntheticSnapshots.length} synthetic documents match the seed contract, ` +
    `${invitationSnapshots.length} invitation documents are valid, and metadata is current.`,
  );
  console.log(
    'Excluded collection document counts: ' +
    EXCLUDED_COLLECTIONS.map((collectionName) => (
      `${collectionName}=${excludedCounts[collectionName]}`
    )).join(', '),
  );
};

const main = async () => {
  const options = parseArguments(process.argv.slice(2));
  const sourceApp = initializeApp({
    credential: applicationDefault(),
    projectId: SOURCE_PROJECT,
  }, 'staging-seed-source');
  const targetApp = initializeApp({
    credential: applicationDefault(),
    projectId: TARGET_PROJECT,
  }, 'staging-seed-target');

  try {
    const sourceDb = getFirestore(sourceApp);
    const targetDb = getFirestore(targetApp);
    const [sourceDocuments, invitationPlan] = await Promise.all([
      loadSourceDocuments(sourceDb),
      planInvitationCodes(targetDb),
    ]);

    printPlan({ ...options, sourceDocuments, invitationPlan });

    if (options.verify) {
      await verifySeed({ targetDb, sourceDocuments, invitationPlan });
      return;
    }

    if (!options.apply) {
      console.log('Dry run only. Re-run with --apply to write to staging.');
      return;
    }

    await applySeed({ targetDb, sourceDocuments, invitationPlan });
  } finally {
    await Promise.all([deleteApp(sourceApp), deleteApp(targetApp)]);
  }
};

main().catch((error) => {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
});
