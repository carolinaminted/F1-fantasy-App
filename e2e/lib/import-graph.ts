import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { REPO_ROOT } from './paths.ts';

export type Reader = (relPath: string) => string | null;

const memo = (read: Reader): Reader => {
  const cache = new Map<string, string | null>();
  return (p) => { if (!cache.has(p)) cache.set(p, read(p)); return cache.get(p)!; };
};

export const fsReader = (root: string): Reader => memo((p) => {
  const abs = join(root, p);
  return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : null;
});

// Reads files as they are at a commit, so --plan needs no checkout of the base.
export const gitReader = (sha: string, cwd = REPO_ROOT): Reader => memo((p) => {
  const opts = { cwd, encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'ignore'] as ('ignore' | 'pipe')[], maxBuffer: 32 * 1024 * 1024 };
  try {
    if (execFileSync('git', ['cat-file', '-t', `${sha}:${p}`], opts).trim() !== 'blob') return null;
    return execFileSync('git', ['show', `${sha}:${p}`], opts);
  } catch {
    return null;
  }
});

// Type-only imports are skipped: they cannot change what renders.
const STATIC_IMPORT = /^\s*(?:import|export)\s+(type\s+)?[^'";]*?['"](\.{1,2}\/[^'"]+)['"]/gm;
const DYNAMIC_IMPORT = /import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

export function relativeImports(source: string): string[] {
  const out: string[] = [];
  for (const m of source.matchAll(STATIC_IMPORT)) if (!m[1]) out.push(m[2]);
  for (const m of source.matchAll(DYNAMIC_IMPORT)) out.push(m[1]);
  return out;
}

const SUFFIXES = ['.tsx', '.ts', '/index.tsx', '/index.ts'];

export function resolveImport(fromFile: string, spec: string, read: Reader): string | null {
  const base = posix.normalize(posix.join(posix.dirname(fromFile), spec));
  const candidates = /\.[a-z]+$/i.test(posix.basename(base)) ? [base] : SUFFIXES.map((s) => base + s);
  return candidates.find((c) => read(c) !== null) ?? null;
}

export function importClosure(entries: string[], read: Reader, stopAt: (file: string) => boolean): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    const source = read(file);
    if (source === null) continue;
    seen.add(file);
    // A shared file already selects every surface, so following it would only blur the graph.
    if (stopAt(file) && !entries.includes(file)) continue;
    for (const spec of relativeImports(source)) {
      const next = resolveImport(file, spec, read);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

export function closuresFor(surfaces: { id: string; entries: string[] }[], readers: Reader[], stopAt: (file: string) => boolean): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const s of surfaces) {
    const files = new Set<string>();
    for (const read of readers) for (const f of importClosure(s.entries, read, stopAt)) files.add(f);
    out.set(s.id, files);
  }
  return out;
}
