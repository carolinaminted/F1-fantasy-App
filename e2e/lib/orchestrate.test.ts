import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readRunJson, runName, selectionFor } from './orchestrate.ts';
import { SURFACES } from '../surfaces.ts';

const ref = { kind: 'ref' as const, ref: 'x', sha: 'a'.repeat(40) };

test('runName is sortable and filesystem-safe', () => {
  assert.equal(runName(new Date('2026-11-26T22:15:03.123Z'), 'origin/prod', 'worktree'), '20261126T221503Z-origin-prod-vs-worktree');
});

test('explicit surfaces win and unknown ones are refused', () => {
  assert.deepEqual(selectionFor({ surfaces: ['league', 'home'], all: false, base: ref, head: ref }), { all: false, ids: ['home', 'league'], reasons: ['--surfaces'] });
  assert.throws(() => selectionFor({ surfaces: ['nope'], all: false, base: ref, head: ref }), /unknown surface/);
});

test('--all and URL sides select everything without reading git', () => {
  assert.equal(selectionFor({ surfaces: null, all: true, base: ref, head: ref }).ids.length, SURFACES.length);
  const url = { kind: 'url' as const, url: 'https://f1.staging.carolinaminted.net' };
  assert.deepEqual(selectionFor({ surfaces: null, all: false, base: ref, head: url }).reasons, ['a URL side has no source to diff → all']);
});

test('a missing or truncated playwright.json becomes an errors entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-run-'));
  const f = join(dir, 'playwright.json');
  assert.match((readRunJson(f) as any).errors[0].message, /was not written/);
  writeFileSync(f, '{"suites":[');
  assert.match((readRunJson(f) as any).errors[0].message, /is not valid JSON: /);
});
