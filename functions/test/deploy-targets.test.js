const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  CALLABLES,
  DEPLOY_TARGETS,
  TRIGGERS,
  onlyFunctionsFlag,
  resolveDeployTarget,
} = require('../deploy-targets');

// Parsed from source rather than required: loading index.js initialises the Admin SDK.
const exportedFunctions = () =>
  [...fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8')
    .matchAll(/^exports\.(\w+)\s*=/gm)]
    .map(([, name]) => name)
    .sort();

test('every exported function is either a trigger or a callable', () => {
  assert.deepEqual([...TRIGGERS, ...CALLABLES].sort(), exportedFunctions());
  assert.equal(TRIGGERS.filter((name) => CALLABLES.includes(name)).length, 0);
});

test('staging deploys every exported function', () => {
  assert.deepEqual([...DEPLOY_TARGETS['formula-fantasy-staging'].functions], exportedFunctions());
});

test('the data plane deploys only the two Firestore triggers', () => {
  assert.deepEqual([...DEPLOY_TARGETS['formula-fantasy-1'].functions], [
    'updateLeaderboardOnCancellation',
    'updateLeaderboardOnResults',
  ]);
});

test('the portal deploys only the five callables', () => {
  assert.deepEqual(resolveDeployTarget('lights-out-league-prod'), {
    region: 'us-central1',
    runtime: 'nodejs22',
    functions: [
      'manualLeaderboardSync',
      'sendAuthCode',
      'sendPasswordResetLink',
      'validateInvitationCode',
      'verifyAuthCode',
    ],
  });
});

test('builds the firebase --only value', () => {
  assert.equal(
    onlyFunctionsFlag('formula-fantasy-1'),
    'functions:updateLeaderboardOnCancellation,functions:updateLeaderboardOnResults',
  );
});

test('refuses an undeclared project', () => {
  assert.throws(() => resolveDeployTarget('gen-lang-client-0034225567'), /No deploy target/);
});

test('CLI prints the --only value and fails on an unknown project', () => {
  const cli = path.join(__dirname, '..', 'deploy-targets.js');
  assert.equal(
    execFileSync('node', [cli, 'lights-out-league-prod', '--only'], { encoding: 'utf8' }).trim(),
    onlyFunctionsFlag('lights-out-league-prod'),
  );
  assert.throws(() => execFileSync('node', [cli, 'nope'], { stdio: 'pipe' }));
});

test('deploy-staging.sh lists the same functions as the staging target', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', '..', 'deploy-staging.sh'), 'utf8');
  const [, body] = script.match(/^readonly STAGING_FUNCTIONS=\(([^)]*)\)/m);
  assert.deepEqual(body.split(/\s+/).filter(Boolean).sort(), [
    ...DEPLOY_TARGETS['formula-fantasy-staging'].functions,
  ]);
});
