import { execFileSync } from 'node:child_process';
import { assertAllowedBaseUrl, GuardError } from './guards.ts';
import { REPO_ROOT } from './paths.ts';

export const STAGING_ORIGIN = 'https://f1.staging.carolinaminted.net';

export type Target = { kind: 'worktree' } | { kind: 'url'; url: string } | { kind: 'ref'; ref: string };
export type Resolved =
  | { kind: 'worktree'; root: string; sha: string; dirty: boolean }
  | { kind: 'ref'; ref: string; sha: string }
  | { kind: 'url'; url: string };

export function classifyTarget(raw: string): Target {
  if (raw === 'worktree') return { kind: 'worktree' };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    assertAllowedBaseUrl(raw);
    // Local servers are started by compare itself in --mode staging; an existing one could be in any mode.
    if (new URL(raw).origin !== STAGING_ORIGIN) throw new GuardError(`a URL side must be ${STAGING_ORIGIN}`);
    return { kind: 'url', url: STAGING_ORIGIN };
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._/~^@{}-]*$/.test(raw)) throw new Error(`not a git ref: ${raw}`);
  return { kind: 'ref', ref: raw };
}

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

export function resolveTarget(t: Target, cwd = REPO_ROOT): Resolved {
  if (t.kind === 'url') return t;
  if (t.kind === 'worktree') return { kind: 'worktree', root: cwd, sha: git(cwd, ['rev-parse', 'HEAD']), dirty: git(cwd, ['status', '--porcelain']).length > 0 };
  return { kind: 'ref', ref: t.ref, sha: git(cwd, ['rev-parse', '--verify', '--end-of-options', `${t.ref}^{commit}`]) };
}
