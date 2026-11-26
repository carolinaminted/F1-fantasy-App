import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { SURFACES } from '../surfaces.ts';
import { closuresFor, fsReader, gitReader, type Reader } from './import-graph.ts';
import { isShared, selectSurfaces, type Selection } from './select.ts';
import { changedFiles } from './changed-files.ts';
import type { Resolved } from './sides.ts';
import type { CaptureNote, Side } from './capture-plan.ts';
import { readPlaywrightErrors, readPlaywrightResults } from './run-results.ts';
import { buildRows, groupOutcomes, type DiffResult, type Report, type SideInfo } from './report.ts';
import { diffAria, diffPng } from './diff.ts';
import { renderGallery } from './gallery.ts';
import { E2E_ROOT } from './paths.ts';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

export const runName = (startedAt: Date, base: string, head: string): string =>
  `${startedAt.toISOString().replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '')}-${slug(base)}-vs-${slug(head)}`;

const readerFor = (r: Exclude<Resolved, { kind: 'url' }>): Reader => (r.kind === 'worktree' ? fsReader(r.root) : gitReader(r.sha));

export function selectionFor(o: { surfaces: string[] | null; all: boolean; base: Resolved; head: Resolved }): Selection {
  const ids = SURFACES.map((s) => s.id);
  if (o.surfaces) {
    const unknown = o.surfaces.filter((s) => !ids.includes(s));
    if (unknown.length) throw new Error(`unknown surface(s): ${unknown.join(', ')}; known: ${ids.join(', ')}`);
    return { all: false, ids: ids.filter((id) => o.surfaces!.includes(id)), reasons: ['--surfaces'] };
  }
  if (o.all) return { all: true, ids, reasons: ['--all'] };
  if (o.base.kind === 'url' || o.head.kind === 'url') return { all: true, ids, reasons: ['a URL side has no source to diff → all'] };
  // Both trees, so a file deleted in head still selects the surfaces that imported it in base.
  const closures = closuresFor(SURFACES, [readerFor(o.base), readerFor(o.head)], isShared);
  return selectSurfaces(changedFiles(o.base.sha, o.head), closures);
}

export function runPlaywrightCapture(o: { runDir: string; sides: Side[]; surfaceIds: string[]; frozenAt: number; full: boolean; setupBaseURL: string }): number {
  const projects = ['capture-desktop', 'capture-mobile', ...(o.full ? ['capture-webkit-mobile'] : [])];
  const r = spawnSync('npx', ['playwright', 'test', ...projects.flatMap((p) => ['--project', p])], {
    cwd: E2E_ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      E2E_SIDES: JSON.stringify(o.sides),
      E2E_SURFACES: o.surfaceIds.join(','),
      E2E_FROZEN_AT: String(o.frozenAt),
      E2E_RUN_DIR: o.runDir,
      E2E_BASE_URL: o.setupBaseURL,
      E2E_SERVERS_MANAGED: '1',
      E2E_FULL: o.full ? '1' : '0',
    },
  });
  return r.status ?? 1;
}

export function finalizeRun(o: { runDir: string; run: string; startedAt: Date; frozenAt: number; sides: SideInfo[]; selection: Selection }): Report {
  const jsonPath = join(o.runDir, 'playwright.json');
  const json: unknown = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : { errors: [{ message: `${jsonPath} was not written` }] };
  const { groups, hardFailures, warnings, blockedWrites } = groupOutcomes(readPlaywrightResults(json));
  hardFailures.push(...readPlaywrightErrors(json).map((error) => ({ title: 'run', project: 'global', error })));
  const rel = (abs: string) => relative(o.runDir, abs).split(sep).join('/');
  const diffFor = (a: CaptureNote, b: CaptureNote): DiffResult => {
    const png = diffPng(readFileSync(a.png), readFileSync(b.png));
    const diffImage = join(o.runDir, 'diff', `${a.key}.png`);
    if (png.diffPixels > 0 || png.sizeChanged) {
      mkdirSync(dirname(diffImage), { recursive: true });
      writeFileSync(diffImage, png.diffPng);
    }
    const aria = diffAria(readFileSync(a.aria, 'utf8'), readFileSync(b.aria, 'utf8'), `${a.key}.aria.yml`);
    return { diffPixels: png.diffPixels, diffRatio: png.diffRatio, sizeChanged: png.sizeChanged, ariaChanged: aria.changed, ariaPatch: aria.patch, diffImage };
  };
  const rows = buildRows(groups, o.sides.map((s) => s.name), diffFor, rel);
  const report: Report = {
    run: o.run, startedAt: o.startedAt.toISOString(), durationMs: Date.now() - o.startedAt.getTime(), frozenAt: o.frozenAt,
    sides: o.sides, selection: o.selection, rows, hardFailures, warnings, blockedWrites,
  };
  writeFileSync(join(o.runDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(o.runDir, 'index.html'), renderGallery(report));
  return report;
}

export function printSummary(report: Report, runDir: string): void {
  const count = (s: string) => report.rows.filter((r) => r.status === s).length;
  console.log(`\n${count('changed')} changed, ${count('failed')} failed, ${count('missing')} missing, ${count('unchanged')} unchanged${count('captured') ? `, ${count('captured')} captured` : ''} in ${Math.round(report.durationMs / 1000)} s`);
  for (const f of report.hardFailures) console.log(`HARD FAILURE ${f.project} ${f.title}: ${f.error.split('\n')[0]}`);
  for (const w of report.warnings) console.log(`warning ${w.project} ${w.title}: ${w.error.split('\n')[0]}`);
  console.log(`gallery: ${join(runDir, 'index.html')}\nreport:  ${join(runDir, 'report.json')}`);
}
