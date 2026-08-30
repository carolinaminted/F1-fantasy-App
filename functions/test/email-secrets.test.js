const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SECRET_NAMES_BY_PROJECT,
  VALID_SECRET_NAME,
  resolveDeployProjectId,
  resolveEmailSecretNames,
} = require('../email-secrets');

test('every configured secret name is a usable defineSecret identifier', () => {
  for (const [projectId, names] of SECRET_NAMES_BY_PROJECT) {
    for (const [role, name] of Object.entries(names)) {
      assert.ok(
        VALID_SECRET_NAME.test(name),
        `${projectId} maps ${role} to a malformed secret name: ${name}`,
      );
    }
  }
});

test('rejects a name with characters Secret Manager will not take', () => {
  assert.ok(!VALID_SECRET_NAME.test('lol staging email pass'));
  assert.ok(!VALID_SECRET_NAME.test('projects/x/secrets/lol-staging-email-pass'));
  assert.ok(!VALID_SECRET_NAME.test(''));
});

test('resolves the staging secrets', () => {
  assert.deepEqual(resolveEmailSecretNames({ GCLOUD_PROJECT: 'formula-fantasy-staging' }), {
    user: 'lol-staging-email-user',
    pass: 'lol-staging-email-pass',
  });
});

test('resolves the prod secrets', () => {
  assert.deepEqual(resolveEmailSecretNames({ GCLOUD_PROJECT: 'lights-out-league-prod' }), {
    user: 'lol-prod-email-user',
    pass: 'lol-prod-email-pass',
  });
});

// formula-fantasy-1 holds the credential as plaintext function config and has no such secret.
// Returning null there is what keeps an emergency deploy to live production unblocked.
test('live production falls through to the environment rather than a missing secret', () => {
  assert.equal(resolveEmailSecretNames({ GCLOUD_PROJECT: 'formula-fantasy-1' }), null);
});

test('an unknown project falls through too', () => {
  assert.equal(resolveEmailSecretNames({ GCLOUD_PROJECT: 'some-other-project' }), null);
});

test('reads the project from FIREBASE_CONFIG when GCLOUD_PROJECT is absent', () => {
  assert.equal(
    resolveDeployProjectId({
      FIREBASE_CONFIG: JSON.stringify({ projectId: 'formula-fantasy-staging' }),
    }),
    'formula-fantasy-staging',
  );
});

test('malformed FIREBASE_CONFIG resolves to no project instead of throwing', () => {
  assert.equal(resolveDeployProjectId({ FIREBASE_CONFIG: '{not json' }), '');
});

test('a malformed table entry fails loudly, naming the offender', () => {
  const original = SECRET_NAMES_BY_PROJECT.get('formula-fantasy-staging');
  SECRET_NAMES_BY_PROJECT.set('formula-fantasy-staging', { user: 'ok', pass: 'not ok' });
  try {
    assert.throws(
      () => resolveEmailSecretNames({ GCLOUD_PROJECT: 'formula-fantasy-staging' }),
      /pass secret for formula-fantasy-staging is malformed: "not ok"/,
    );
  } finally {
    SECRET_NAMES_BY_PROJECT.set('formula-fantasy-staging', original);
  }
});
