import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv, upsertEnvFile, loadE2EEnv } from './env.ts';

test('parseEnv ignores comments and blank lines, keeps = inside values', () => {
  assert.deepEqual(parseEnv('# c\n\nA=1\nB = two \nC=x=y\n'), { A: '1', B: 'two', C: 'x=y' });
});

test('upsertEnvFile replaces existing keys, appends new ones, and sets mode 600', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-env-'));
  const file = join(dir, '.env.e2e');
  writeFileSync(file, 'E2E_MAIL_USER=a@b.c\nKEEP=1\n');
  upsertEnvFile(file, { E2E_MAIL_USER: 'x@y.z', E2E_NEW: 'n' });
  assert.equal(readFileSync(file, 'utf8'), 'E2E_MAIL_USER=x@y.z\nKEEP=1\nE2E_NEW=n\n');
  assert.equal(statSync(file).mode & 0o777, 0o600);
});

test('loadE2EEnv names missing keys without printing values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-env-'));
  const file = join(dir, '.env.e2e');
  writeFileSync(file, 'PRESENT=secret-value\n');
  process.env.E2E_ENV_FILE = file;
  try {
    assert.equal(loadE2EEnv(['PRESENT']).PRESENT, 'secret-value');
    assert.throws(() => loadE2EEnv(['PRESENT', 'MISSING_ONE']), (e: Error) => /MISSING_ONE/.test(e.message) && !/secret-value/.test(e.message));
  } finally {
    delete process.env.E2E_ENV_FILE;
  }
});
