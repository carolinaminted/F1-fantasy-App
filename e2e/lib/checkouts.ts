import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { assertStagingEnvFile, GuardError, stagingWebApiKey } from './guards.ts';
import { REPO_ROOT } from './paths.ts';

export const BASE_PREFIX = 'lol-e2e-base-';

const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const mainCheckout = () => dirname(git(REPO_ROOT, ['rev-parse', '--path-format=absolute', '--git-common-dir']));

// Next to the other worktrees, outside every checkout: /Users/jhh/Codebase/jhh-ai/.worktrees.
export const baseWorktreesDir = (): string => process.env.E2E_BASE_WORKTREES_DIR ?? resolve(mainCheckout(), '..', '.worktrees');
export const baseWorktreePath = (sha: string, dir = baseWorktreesDir()): string => join(dir, `${BASE_PREFIX}${sha.slice(0, 12)}`);

// One detached worktree per commit, reused across runs; npm ci runs once per lockfile.
export function ensureCheckout(sha: string, log: (m: string) => void = console.log): string {
  const root = baseWorktreePath(sha);
  if (existsSync(root)) {
    const at = git(root, ['rev-parse', 'HEAD']);
    if (at !== sha) throw new Error(`${root} is at ${at}, expected ${sha}; remove it with: npm run e2e:compare -- --prune-bases`);
  } else {
    log(`creating base worktree ${root}`);
    git(REPO_ROOT, ['worktree', 'add', '--detach', root, sha]);
  }
  const lockHash = createHash('sha256').update(readFileSync(join(root, 'package-lock.json'))).digest('hex');
  const marker = join(root, 'node_modules', '.e2e-lock-hash');
  if (!existsSync(marker) || readFileSync(marker, 'utf8') !== lockHash) {
    log(`npm ci in ${root} (first use of this commit)`);
    execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
    writeFileSync(marker, lockHash);
  }
  assertStagingEnvFile(root);
  if (stagingWebApiKey(root) !== stagingWebApiKey(REPO_ROOT)) {
    throw new GuardError(`${root}/.env.staging has a different web API key from this checkout, so the request guard would block it`);
  }
  return root;
}

// Removes only harness-owned base worktrees. --force because their node_modules is untracked.
export function pruneBaseWorktrees(): string[] {
  const paths = git(REPO_ROOT, ['worktree', 'list', '--porcelain'])
    .split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice('worktree '.length))
    .filter((p) => basename(p).startsWith(BASE_PREFIX));
  for (const p of paths) git(REPO_ROOT, ['worktree', 'remove', '--force', p]);
  return paths;
}
