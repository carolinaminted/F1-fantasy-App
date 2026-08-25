const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveRuntimeTarget } = require('../runtime-target');
const portalCallables = require('../portal-callables.json');

test('portal manifest selects only the five callable functions', () => {
  assert.equal(portalCallables.region, 'us-central1');
  assert.equal(portalCallables.runtime, 'nodejs22');
  assert.deepEqual(portalCallables.functions, [
    'manualLeaderboardSync',
    'sendAuthCode',
    'sendPasswordResetLink',
    'validateInvitationCode',
    'verifyAuthCode',
  ]);
});

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
