import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { E2E_ROOT } from './paths.ts';

// A request context made this way belongs to no browser context, so no guard can see it.
const UNGUARDED = /\brequest\s*\.\s*newContext\s*\(/;
const SELF = 'lib/no-unguarded-request.test.ts';

const sources = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  if (e.name === 'node_modules' || e.name.startsWith('.')) return [];
  const path = join(dir, e.name);
  return e.isDirectory() ? sources(path) : e.name.endsWith('.ts') ? [path] : [];
});

test('no harness file opens a standalone API request context', () => {
  const offenders = sources(E2E_ROOT)
    .map((f) => relative(E2E_ROOT, f))
    .filter((f) => f !== SELF && UNGUARDED.test(readFileSync(join(E2E_ROOT, f), 'utf8')));
  assert.deepEqual(offenders, []);
});
