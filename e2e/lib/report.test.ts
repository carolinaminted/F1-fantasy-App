import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRows, groupOutcomes, type DiffResult } from './report.ts';
import type { TestOutcome } from './run-results.ts';

const target = (surface: string, side: string, project = 'capture-desktop') =>
  ({ key: `${project}/${surface}--dark`, surface, theme: 'dark', project, side });
const ok = (surface: string, side: string, extra: Record<string, unknown> = {}, project = 'capture-desktop'): TestOutcome => ({
  title: `${surface} dark [${side}]`, project, status: 'passed',
  annotations: [
    { type: 'capture-target', description: JSON.stringify(target(surface, side, project)) },
    { type: 'capture', description: JSON.stringify({ ...target(surface, side, project), png: `/r/${side}/${surface}.png`, aria: `/r/${side}/${surface}.aria.yml`, unstable: false, blockedWrites: ['WRITE POST https://x/Write/channel'], url: '/', ...extra }) },
  ],
});
const failed = (surface: string, side: string, project = 'capture-desktop'): TestOutcome => ({
  title: `${surface} dark [${side}]`, project, status: 'failed', error: 'page overflows horizontally by 9px: div#x\nmore',
  annotations: [{ type: 'capture-target', description: JSON.stringify(target(surface, side, project)) }],
});
const same: DiffResult = { diffPixels: 0, diffRatio: 0, sizeChanged: false, ariaChanged: false, ariaPatch: '', diffImage: '/r/diff/x.png' };
const rel = (abs: string) => abs.replace('/r/', '');

test('groups notes by key, gates Chromium failures and only warns for WebKit', () => {
  const g = groupOutcomes([ok('home', 'base'), failed('home', 'head'), failed('home', 'head', 'capture-webkit-mobile'), { title: 'sign in as admin', project: 'setup', status: 'failed', error: 'x', annotations: [] }]);
  assert.equal(g.groups.get('capture-desktop/home--dark')!.notes.size, 1);
  assert.deepEqual(g.groups.get('capture-desktop/home--dark')!.failures, ['[head] page overflows horizontally by 9px: div#x']);
  assert.deepEqual(g.hardFailures.map((f) => f.project), ['capture-desktop', 'setup']);
  assert.deepEqual(g.warnings.map((f) => f.project), ['capture-webkit-mobile']);
  assert.deepEqual(g.blockedWrites, ['WRITE POST https://x/Write/channel']);
});

test('rows: failed first, then changed by ratio, then missing, then unchanged', () => {
  const g = groupOutcomes([
    ok('a', 'base'), ok('a', 'head'),
    ok('b', 'base'), ok('b', 'head'),
    ok('c', 'base'),
    ok('d', 'base'), failed('d', 'head'),
    ok('e', 'base'), ok('e', 'head'),
  ]);
  const diffs: Record<string, DiffResult> = {
    a: same,
    b: { ...same, diffPixels: 50, diffRatio: 0.5 },
    e: { ...same, diffPixels: 10, diffRatio: 0.1, ariaChanged: true, ariaPatch: 'patch' },
  };
  const rows = buildRows(g.groups, ['base', 'head'], (base) => diffs[base.surface], rel);
  assert.deepEqual(rows.map((r) => [r.surface, r.status]), [['d', 'failed'], ['b', 'changed'], ['e', 'changed'], ['c', 'missing'], ['a', 'unchanged']]);
  assert.deepEqual(rows[1].images, { base: 'base/b.png', head: 'head/b.png', diff: 'diff/x.png' });
  assert.equal(rows.find((r) => r.surface === 'a')!.images.diff, undefined);
});

test('a one-side run marks rows captured without diffing', () => {
  const g = groupOutcomes([ok('a', 'after-conclude')]);
  const rows = buildRows(g.groups, ['after-conclude'], () => { throw new Error('no diff for one side'); }, rel);
  assert.deepEqual(rows.map((r) => r.status), ['captured']);
});
