const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SERVICE_ACCOUNT_BY_PROJECT,
  VALID_SERVICE_ACCOUNT,
  resolveDeployProjectId,
  resolveRuntimeServiceAccount,
} = require('../runtime-service-account');

test('every configured account is a shape firebase-tools accepts', () => {
  for (const [projectId, serviceAccount] of SERVICE_ACCOUNT_BY_PROJECT) {
    assert.ok(
      VALID_SERVICE_ACCOUNT.test(serviceAccount),
      `${projectId} maps to a malformed service account: ${serviceAccount}`,
    );
  }
});

test('a bare name is rejected — the mistake that failed a deploy mid-flight', () => {
  assert.ok(!VALID_SERVICE_ACCOUNT.test('lol-functions-runtime'));
});

test('accepts the short trailing-@ form firebase-tools also allows', () => {
  assert.ok(VALID_SERVICE_ACCOUNT.test('lol-functions-runtime@'));
});

test('resolves the staging account', () => {
  assert.equal(
    resolveRuntimeServiceAccount({ GCLOUD_PROJECT: 'formula-fantasy-staging' }),
    'lol-functions-runtime@formula-fantasy-staging.iam.gserviceaccount.com',
  );
});

test('resolves the prod-staging account', () => {
  assert.equal(
    resolveRuntimeServiceAccount({ GCLOUD_PROJECT: 'lights-out-league-prod' }),
    'lol-functions-runtime@lights-out-league-prod.iam.gserviceaccount.com',
  );
});

test('leaves the live production project on the platform default', () => {
  assert.equal(resolveRuntimeServiceAccount({ GCLOUD_PROJECT: 'formula-fantasy-1' }), null);
});

test('an unlisted project falls through to the platform default', () => {
  assert.equal(resolveRuntimeServiceAccount({ GCLOUD_PROJECT: 'some-other-project' }), null);
  assert.equal(resolveRuntimeServiceAccount({}), null);
});

test('a project id colliding with an Object prototype member resolves to nothing', () => {
  // A Map lookup cannot return Object.prototype.constructor for a project literally named
  // "constructor", which is a formally valid GCP project id.
  assert.equal(resolveRuntimeServiceAccount({ GCLOUD_PROJECT: 'constructor' }), null);
  assert.equal(resolveRuntimeServiceAccount({ GCLOUD_PROJECT: '__proto__' }), null);
});

test('reads the deploy project from FIREBASE_CONFIG when GCLOUD_PROJECT is absent', () => {
  assert.equal(
    resolveDeployProjectId({
      FIREBASE_CONFIG: JSON.stringify({ projectId: 'formula-fantasy-staging' }),
    }),
    'formula-fantasy-staging',
  );
});

test('prefers GCLOUD_PROJECT over FIREBASE_CONFIG', () => {
  assert.equal(
    resolveDeployProjectId({
      GCLOUD_PROJECT: 'lights-out-league-prod',
      FIREBASE_CONFIG: JSON.stringify({ projectId: 'formula-fantasy-staging' }),
    }),
    'lights-out-league-prod',
  );
});

test('malformed FIREBASE_CONFIG resolves to no project rather than throwing', () => {
  assert.equal(resolveDeployProjectId({ FIREBASE_CONFIG: '{{{ not json' }), '');
});
