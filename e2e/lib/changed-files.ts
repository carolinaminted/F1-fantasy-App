import { execFileSync } from 'node:child_process';
import { REPO_ROOT } from './paths.ts';
import type { Resolved } from './sides.ts';

export const lines = (text: string): string[] => text.split('\n').map((l) => l.trim()).filter(Boolean);

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });

// --no-renames lists both the old and the new path, so either side's importers are selected.
export function changedFiles(baseSha: string, head: Resolved, cwd = REPO_ROOT): string[] {
  if (head.kind === 'url') throw new Error('a URL side has no source to diff');
  const files = head.kind === 'worktree'
    ? [...lines(git(cwd, ['diff', '--name-only', '--no-renames', baseSha])), ...lines(git(cwd, ['ls-files', '--others', '--exclude-standard']))]
    : lines(git(cwd, ['diff', '--name-only', '--no-renames', baseSha, head.sha]));
  return [...new Set(files)].sort();
}
