import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_TOOLS, STANDINGS_VIEWS, SURFACES } from '../surfaces.ts';
import { fsReader, importClosure } from './import-graph.ts';
import { isShared } from './select.ts';
import { REPO_ROOT } from './paths.ts';

const appSource = (rel: string) => readFileSync(join(REPO_ROOT, rel), 'utf8');
const block = (src: string, start: string, end: string) => { const i = src.indexOf(start); return src.slice(i, src.indexOf(end, i)); };

test('there are 26 surfaces with unique kebab-case ids and app-relative paths', () => {
  assert.equal(SURFACES.length, 26);
  assert.equal(new Set(SURFACES.map((s) => s.id)).size, SURFACES.length);
  for (const s of SURFACES) {
    assert.match(s.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.match(s.path, /^\//);
  }
});

test('every entry file exists', () => {
  for (const s of SURFACES) for (const e of s.entries) assert.ok(existsSync(join(REPO_ROOT, e)), `${s.id}: ${e}`);
});

test('standings views match LeaderboardPage.tsx VIEWS', () => {
  const views = [...block(appSource('components/LeaderboardPage.tsx'), 'const VIEWS', '];').matchAll(/value:\s*'([a-z0-9]+)'/g)].map((m) => m[1]);
  assert.deepEqual(views.sort(), [...STANDINGS_VIEWS].sort());
});

test('admin tools match routes.ts ADMIN_TOOLS', () => {
  const tools = [...block(appSource('routes.ts'), 'export const ADMIN_TOOLS', '] as const').matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  assert.deepEqual(tools.sort(), [...ADMIN_TOOLS].sort());
});

test('closures follow real imports and stop at shared files', () => {
  const read = fsReader(REPO_ROOT);
  const closure = (id: string) => importClosure(SURFACES.find((s) => s.id === id)!.entries, read, isShared);
  assert.ok(closure('standings-hall').has('components/standings/HallOfFameView.tsx'));
  assert.ok(closure('race-results').has('components/SchedulePage.tsx'));
  // Dashboard imports ../App; App.tsx is shared, so its lazy imports must not leak into home.
  assert.ok(!closure('home').has('components/LeaderboardPage.tsx'));
});
