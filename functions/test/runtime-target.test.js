const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PINNED_TARGET_BY_HOST_PROJECT,
  PROJECT_BY_ENVIRONMENT,
  resolveRuntimeTarget,
} = require('../runtime-target');

test('uses the hosting Firebase project when no cross-project target is configured', () => {
  assert.equal(resolveRuntimeTarget({}), null);
});

test('accepts the staging portal target pair', () => {
  assert.deepEqual(resolveRuntimeTarget({
    APP_ENV: 'staging',
    FIREBASE_PROJECT_ID: 'formula-fantasy-staging',
  }), {
    appEnvironment: 'staging',
    firebaseProjectId: 'formula-fantasy-staging',
  });
});

test('accepts the production portal target pair', () => {
  assert.deepEqual(resolveRuntimeTarget({
    APP_ENV: 'production',
    FIREBASE_PROJECT_ID: 'formula-fantasy-1',
  }), {
    appEnvironment: 'production',
    firebaseProjectId: 'formula-fantasy-1',
  });
});

test('rejects partial target configuration', () => {
  assert.throws(
    () => resolveRuntimeTarget({ APP_ENV: 'staging' }),
    /must be configured together/,
  );
});

test('rejects an unsupported environment', () => {
  assert.throws(
    () => resolveRuntimeTarget({ APP_ENV: 'preview', FIREBASE_PROJECT_ID: 'preview-project' }),
    /staging or production/,
  );
});

test('rejects a mixed production and staging target', () => {
  assert.throws(
    () => resolveRuntimeTarget({
      APP_ENV: 'production',
      FIREBASE_PROJECT_ID: 'formula-fantasy-staging',
    }),
    /must target FIREBASE_PROJECT_ID=formula-fantasy-1/,
  );
});

const PORTAL_HOST = { GCLOUD_PROJECT: 'lights-out-league-prod' };
const PRODUCTION_TARGET = { appEnvironment: 'production', firebaseProjectId: 'formula-fantasy-1' };

test('portal host with no env file still targets production data', () => {
  assert.deepEqual(resolveRuntimeTarget(PORTAL_HOST), PRODUCTION_TARGET);
});

test('portal host is resolved from FIREBASE_CONFIG when GCLOUD_PROJECT is absent', () => {
  assert.deepEqual(
    resolveRuntimeTarget({ FIREBASE_CONFIG: JSON.stringify({ projectId: 'lights-out-league-prod' }) }),
    PRODUCTION_TARGET,
  );
});

test('portal host accepts env values that agree with its pin', () => {
  assert.deepEqual(resolveRuntimeTarget({
    ...PORTAL_HOST,
    APP_ENV: 'production',
    FIREBASE_PROJECT_ID: 'formula-fantasy-1',
  }), PRODUCTION_TARGET);
});

test('portal host rejects env values that point at staging', () => {
  assert.throws(
    () => resolveRuntimeTarget({
      ...PORTAL_HOST,
      APP_ENV: 'staging',
      FIREBASE_PROJECT_ID: 'formula-fantasy-staging',
    }),
    /pinned to formula-fantasy-1/,
  );
});

test('data-plane projects keep using their own Firestore', () => {
  assert.equal(resolveRuntimeTarget({ GCLOUD_PROJECT: 'formula-fantasy-1' }), null);
  assert.equal(resolveRuntimeTarget({ GCLOUD_PROJECT: 'formula-fantasy-staging' }), null);
});

test('no pinned host ever targets its own project', () => {
  for (const [host, environment] of Object.entries(PINNED_TARGET_BY_HOST_PROJECT)) {
    assert.ok(PROJECT_BY_ENVIRONMENT[environment], `${host} pins an unknown environment`);
    assert.notEqual(PROJECT_BY_ENVIRONMENT[environment], host);
  }
});
