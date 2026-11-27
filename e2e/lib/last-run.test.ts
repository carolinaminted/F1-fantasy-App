import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Report } from './report.ts';
import { runLine } from './last-run.ts';

const SHA = 'a'.repeat(40);
const report = (over: Partial<Report> & { headSha?: string; dirty?: boolean }): Report => ({
  run: over.run ?? 'r1', startedAt: over.startedAt ?? '2026-11-26T10:00:00Z', durationMs: 1, frozenAt: 0,
  sides: [{ name: 'base', target: 'origin/prod', sha: 'b'.repeat(40), url: 'u' }, { name: 'head', target: 'staging', sha: over.headSha ?? SHA, dirty: over.dirty, url: 'u' }],
  selection: { all: true, ids: [], reasons: [] },
  rows: over.rows ?? [], hardFailures: over.hardFailures ?? [], warnings: [], blockedWrites: [],
});
const row = (status: Report['rows'][number]['status']) => ({ key: 'k', surface: 's', theme: 'dark', project: 'p', status, diffPixels: 0, diffRatio: 0, sizeChanged: false, ariaChanged: false, unstable: false, images: {}, failures: [] });

test('summarises the latest clean-head compare run for the commit', () => {
  const older = report({ run: 'old', startedAt: '2026-11-25T10:00:00Z' });
  const newer = report({ run: 'new', rows: [row('changed'), row('unchanged'), row('unchanged')] });
  assert.equal(runLine([older, newer], SHA), '  [~] e2e: new vs origin/prod: 1 changed, 0 hard failures, 3 rows (warn only)');
});

test('a run that selected no surfaces says so instead of reporting zeros', () => {
  assert.equal(runLine([report({ run: 'empty', rows: [] })], SHA), '  [~] e2e: empty vs origin/prod: no surfaces selected (warn only)');
});

test('ignores runs whose head had uncommitted changes or another commit', () => {
  const line = runLine([report({ dirty: true }), report({ headSha: 'c'.repeat(40) })], SHA);
  assert.match(line, /^  \[~\] e2e: no compare run has this commit as its head/);
});
