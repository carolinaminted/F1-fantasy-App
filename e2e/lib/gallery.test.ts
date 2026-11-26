import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGallery } from './gallery.ts';
import type { CaptureRow, Report } from './report.ts';

const row = (surface: string, status: CaptureRow['status'], extra: Partial<CaptureRow> = {}): CaptureRow => ({
  key: `capture-desktop/${surface}--dark`, surface, theme: 'dark', project: 'capture-desktop', status,
  diffPixels: 0, diffRatio: 0, sizeChanged: false, ariaChanged: false, unstable: false,
  images: { base: `base/${surface}.png`, head: `head/${surface}.png` }, failures: [], ...extra,
});
const report = (rows: CaptureRow[], extra: Partial<Report> = {}): Report => ({
  run: 'r1', startedAt: '2026-11-26T00:00:00.000Z', durationMs: 1000, frozenAt: 0,
  sides: [{ name: 'base', target: 'staging', sha: 'abc', url: 'http://127.0.0.1:3101' }, { name: 'head', target: 'worktree', sha: 'def', dirty: true, url: 'http://127.0.0.1:3100' }],
  selection: { all: false, ids: ['a', 'b'], reasons: ['components/X.tsx → a, b'] },
  rows, hardFailures: [], warnings: [], blockedWrites: [], ...extra,
});

test('escapes text from the page and the run', () => {
  const html = renderGallery(report([row('a', 'changed', { diffPixels: 1, diffRatio: 0.5, ariaChanged: true, ariaPatch: '+ <script>alert(1)</script>' })]));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('changed cards come before the collapsed unchanged ones', () => {
  const html = renderGallery(report([row('b', 'changed', { diffPixels: 5, diffRatio: 0.1 }), row('a', 'unchanged')]));
  const unchanged = html.indexOf('<details class="unchanged"');
  assert.ok(unchanged > 0);
  assert.ok(html.indexOf('capture-desktop/b--dark') < unchanged);
  assert.ok(unchanged < html.indexOf('capture-desktop/a--dark'));
  assert.match(html, /1 changed · 0 failed · 0 missing · 1 unchanged/);
});

test('hard failures and selection reasons are shown', () => {
  const html = renderGallery(report([], { hardFailures: [{ title: 'home dark [head]', project: 'capture-desktop', error: 'page overflows' }] }));
  assert.match(html, /page overflows/);
  assert.match(html, /components\/X\.tsx → a, b/);
});
