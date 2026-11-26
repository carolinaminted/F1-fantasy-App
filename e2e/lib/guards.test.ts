import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  GuardError, resolveBaseUrl, assertAllowedBaseUrl, assertNoProdInEnv,
  assertStagingEnvFile, isForbiddenRequestUrl, isWriteRequest, DEFAULT_BASE_URL,
} from './guards.ts';

test('base URL defaults to local Vite and allows only staging hosts', () => {
  assert.equal(resolveBaseUrl(undefined), DEFAULT_BASE_URL);
  assert.equal(resolveBaseUrl('https://f1.staging.carolinaminted.net'), 'https://f1.staging.carolinaminted.net');
  assert.doesNotThrow(() => assertAllowedBaseUrl('http://localhost:3101'));
  assert.throws(() => assertAllowedBaseUrl('https://f1.carolinaminted.net'), GuardError);
  assert.throws(() => assertAllowedBaseUrl('https://lights-out-league-web-abc.a.run.app'), GuardError);
  assert.throws(() => assertAllowedBaseUrl('not a url'), GuardError);
});

test('environment naming a production project is refused, naming the variable not the value', () => {
  assert.doesNotThrow(() => assertNoProdInEnv({ HOME: '/Users/x', GOOGLE_CLOUD_PROJECT: 'formula-fantasy-staging' }));
  assert.throws(() => assertNoProdInEnv({ CLOUDSDK_CORE_PROJECT: 'lights-out-league-prod' }), /CLOUDSDK_CORE_PROJECT/);
  assert.throws(() => assertNoProdInEnv({ X: 'gs://formula-fantasy-1-season-backups' }), GuardError);
});

test('.env.staging must name the staging project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-guard-'));
  const good = join(dir, 'good'); writeFileSync(good, 'A=1\nVITE_FIREBASE_PROJECT_ID=formula-fantasy-staging\n');
  const bad = join(dir, 'bad'); writeFileSync(bad, 'VITE_FIREBASE_PROJECT_ID=formula-fantasy-1\n');
  assert.doesNotThrow(() => assertStagingEnvFile(good));
  assert.throws(() => assertStagingEnvFile(bad), GuardError);
});

test('request classifiers', () => {
  assert.equal(isForbiddenRequestUrl('https://firestore.googleapis.com/v1/projects/formula-fantasy-1/databases'), true);
  assert.equal(isForbiddenRequestUrl('https://f1.carolinaminted.net/'), true);
  assert.equal(isForbiddenRequestUrl('https://f1.staging.carolinaminted.net/'), false);
  assert.equal(isForbiddenRequestUrl('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?database=projects%2Fformula-fantasy-staging'), false);

  assert.equal(isWriteRequest('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel?VER=8', 'POST'), true);
  assert.equal(isWriteRequest('https://firestore.googleapis.com/v1/projects/formula-fantasy-staging/databases/(default)/documents:commit', 'POST'), true);
  assert.equal(isWriteRequest('https://us-central1-formula-fantasy-staging.cloudfunctions.net/sendAuthCode', 'POST'), true);
  assert.equal(isWriteRequest('https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen/channel?VER=8', 'POST'), false);
  assert.equal(isWriteRequest('https://securetoken.googleapis.com/v1/token?key=x', 'POST'), false);
});
