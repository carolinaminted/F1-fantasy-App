import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedFiles, lines } from './changed-files.ts';
import { resolveTarget } from './sides.ts';

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { cwd, encoding: 'utf8' }).trim();

test('lines trims and drops blanks', () => {
  assert.deepEqual(lines(' a \n\nb\n'), ['a', 'b']);
});

test('changedFiles covers commits, uncommitted and untracked work, and both sides of a rename', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lol-e2e-changed-'));
  try {
    git(dir, 'init', '-q');
    mkdirSync(join(dir, 'components'));
    writeFileSync(join(dir, 'components/A.tsx'), 'a');
    writeFileSync(join(dir, 'components/Old.tsx'), 'old');
    git(dir, 'add', '.');
    git(dir, 'commit', '-qm', 'one');
    const base = git(dir, 'rev-parse', 'HEAD');
    git(dir, 'mv', 'components/Old.tsx', 'components/New.tsx');
    git(dir, 'commit', '-qm', 'two');
    const head = git(dir, 'rev-parse', 'HEAD');
    assert.deepEqual(changedFiles(base, { kind: 'ref', ref: 'HEAD', sha: head }, dir), ['components/New.tsx', 'components/Old.tsx']);
    writeFileSync(join(dir, 'components/A.tsx'), 'a2');
    writeFileSync(join(dir, 'zz-new.ts'), 'new');
    const wt = resolveTarget({ kind: 'worktree' }, dir);
    assert.equal(wt.kind === 'worktree' && wt.dirty, true);
    assert.deepEqual(changedFiles(base, wt, dir), ['components/A.tsx', 'components/New.tsx', 'components/Old.tsx', 'zz-new.ts']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
