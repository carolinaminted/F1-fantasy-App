import type { CaptureNote, CaptureTarget } from './capture-plan.ts';
import { NOTE_ANNOTATION, TARGET_ANNOTATION } from './capture-plan.ts';
import type { Selection } from './select.ts';
import type { TestOutcome } from './run-results.ts';

export type SideInfo = { name: string; target: string; sha?: string; dirty?: boolean; url: string };
export type RowStatus = 'failed' | 'changed' | 'missing' | 'captured' | 'unchanged';
export type CaptureRow = {
  key: string; surface: string; theme: string; project: string; status: RowStatus;
  diffPixels: number; diffRatio: number; sizeChanged: boolean; ariaChanged: boolean; unstable: boolean;
  images: Record<string, string>;  // side name, or 'diff', to a path relative to the run folder
  ariaPatch?: string; failures: string[];
};
export type Failure = { title: string; project: string; error: string };
export type Report = {
  run: string; startedAt: string; durationMs: number; frozenAt: number; sides: SideInfo[]; selection: Selection;
  rows: CaptureRow[]; hardFailures: Failure[]; warnings: Failure[]; blockedWrites: string[];
};
export type Group = { target: Omit<CaptureTarget, 'side'>; notes: Map<string, CaptureNote>; failures: string[] };
export type DiffResult = { diffPixels: number; diffRatio: number; sizeChanged: boolean; ariaChanged: boolean; ariaPatch: string; diffImage: string };

// WebKit mobile is non-gating until PROD-09 is understood.
export const NON_GATING_PROJECTS = ['capture-webkit-mobile'];
const FAILED = new Set(['failed', 'timedOut', 'interrupted']);

const parse = <T>(outcome: TestOutcome, type: string): T | undefined => {
  const a = outcome.annotations.find((x) => x.type === type);
  return a?.description ? (JSON.parse(a.description) as T) : undefined;
};

export function groupOutcomes(outcomes: TestOutcome[]): { groups: Map<string, Group>; hardFailures: Failure[]; warnings: Failure[]; blockedWrites: string[] } {
  const groups = new Map<string, Group>();
  const hardFailures: Failure[] = [];
  const warnings: Failure[] = [];
  const blocked = new Set<string>();
  for (const o of outcomes) {
    const target = parse<CaptureTarget>(o, TARGET_ANNOTATION);
    let group: Group | undefined;
    if (target) {
      const { side: _side, ...rest } = target;
      group = groups.get(target.key) ?? { target: rest, notes: new Map(), failures: [] };
      groups.set(target.key, group);
    }
    if (FAILED.has(o.status)) {
      const failure = { title: o.title, project: o.project, error: o.error ?? o.status };
      (NON_GATING_PROJECTS.includes(o.project) ? warnings : hardFailures).push(failure);
      if (group && target) group.failures.push(`[${target.side}] ${failure.error.split('\n')[0]}`);
      continue;
    }
    const note = parse<CaptureNote>(o, NOTE_ANNOTATION);
    if (group && note) {
      group.notes.set(note.side, note);
      note.blockedWrites.forEach((b) => blocked.add(b));
    }
  }
  return { groups, hardFailures, warnings, blockedWrites: [...blocked].sort() };
}

const RANK: Record<RowStatus, number> = { failed: 0, changed: 1, missing: 2, captured: 3, unchanged: 4 };

export function buildRows(
  groups: Map<string, Group>,
  sideNames: string[],
  diffFor: (base: CaptureNote, head: CaptureNote) => DiffResult,
  rel: (abs: string) => string,
): CaptureRow[] {
  const rows: CaptureRow[] = [];
  for (const [key, g] of groups) {
    const images: Record<string, string> = {};
    for (const name of sideNames) { const n = g.notes.get(name); if (n) images[name] = rel(n.png); }
    const row: CaptureRow = {
      key, surface: g.target.surface, theme: g.target.theme, project: g.target.project, status: 'missing',
      diffPixels: 0, diffRatio: 0, sizeChanged: false, ariaChanged: false,
      unstable: [...g.notes.values()].some((n) => n.unstable), images, failures: g.failures,
    };
    const [baseName, headName] = sideNames;
    const base = g.notes.get(baseName);
    const head = headName ? g.notes.get(headName) : undefined;
    if (g.failures.length) row.status = 'failed';
    else if (sideNames.length === 1) row.status = base ? 'captured' : 'missing';
    else if (base && head) {
      const d = diffFor(base, head);
      Object.assign(row, { diffPixels: d.diffPixels, diffRatio: d.diffRatio, sizeChanged: d.sizeChanged, ariaChanged: d.ariaChanged });
      const changed = d.diffPixels > 0 || d.sizeChanged || d.ariaChanged;
      row.status = changed ? 'changed' : 'unchanged';
      if (d.diffPixels > 0 || d.sizeChanged) row.images.diff = rel(d.diffImage);
      if (d.ariaChanged) row.ariaPatch = d.ariaPatch;
    }
    rows.push(row);
  }
  return rows.sort((a, b) => RANK[a.status] - RANK[b.status] || b.diffRatio - a.diffRatio || Number(b.ariaChanged) - Number(a.ariaChanged) || a.key.localeCompare(b.key));
}
