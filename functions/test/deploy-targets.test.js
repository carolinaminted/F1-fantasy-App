const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  CALLABLES,
  DEPLOY_TARGETS,
  LONG_RUNNING,
  SEASON_CALLABLES,
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
  assert.deepEqual([...TRIGGERS, ...CALLABLES, ...SEASON_CALLABLES].sort(), exportedFunctions());
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

test('the portal deploys every callable and no trigger', () => {
  assert.deepEqual(resolveDeployTarget('lights-out-league-prod'), {
    region: 'us-central1',
    runtime: 'nodejs22',
    functions: [
      'archiveSeason',
      'backupLeague',
      'concludeSeason',
      'manualLeaderboardSync',
      'openSeason',
      'sendAuthCode',
      'sendPasswordResetLink',
      'startNewSeason',
      'validateInvitationCode',
      'verifyAuthCode',
    ],
  });
});

test('only season callables are long-running, and both projects that host them deploy them', () => {
  assert.deepEqual(Object.keys(LONG_RUNNING).sort(), ['archiveSeason', 'backupLeague', 'startNewSeason']);
  Object.keys(LONG_RUNNING).forEach((name) => {
    assert.ok(SEASON_CALLABLES.includes(name), name);
    assert.ok(DEPLOY_TARGETS['lights-out-league-prod'].functions.includes(name), name);
  });
});

test('index.js takes every long-running setting from LONG_RUNNING', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
  assert.doesNotMatch(source, /(onCall|seasonOpCallable)\([^;]*timeoutSeconds/);
  Object.keys(LONG_RUNNING).forEach((name) => assert.match(source, new RegExp(`LONG_RUNNING\\.${name}\\b`), name));
});

test('CLI prints long-running settings in gcloud form', () => {
  const cli = path.join(__dirname, '..', 'deploy-targets.js');
  assert.equal(
    execFileSync('node', [cli, 'lights-out-league-prod', '--long-running'], { encoding: 'utf8' }),
    'archiveSeason 540 512Mi\nbackupLeague 540 512Mi\nstartNewSeason 540 512Mi\n',
  );
  assert.equal(execFileSync('node', [cli, 'formula-fantasy-1', '--long-running'], { encoding: 'utf8' }), '');
});

test('deploy-portal.sh deploys exactly the portal target', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', '..', 'deploy-portal.sh'), 'utf8');
  const [, body] = script.match(/^readonly DEPLOY_ORDER=\(([^)]*)\)/m);
  assert.deepEqual(body.split(/\s+/).filter(Boolean).sort(), [...DEPLOY_TARGETS['lights-out-league-prod'].functions]);
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
