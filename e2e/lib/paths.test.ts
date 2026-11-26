import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, E2E_ROOT, AUTH_DIR, RESULTS_DIR } from './paths.ts';

test('REPO_ROOT is the app repo root', () => {
  assert.ok(existsSync(join(REPO_ROOT, 'firebaseConfig.ts')));
  assert.ok(existsSync(join(REPO_ROOT, '.env.staging')));
});

test('derived paths sit where .gitignore expects them', () => {
  assert.equal(E2E_ROOT, join(REPO_ROOT, 'e2e'));
  assert.equal(AUTH_DIR, join(REPO_ROOT, 'e2e', '.auth'));
  assert.equal(RESULTS_DIR, join(REPO_ROOT, 'e2e-results'));
});
