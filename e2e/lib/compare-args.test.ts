import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCaptureArgs, parseCompareArgs } from './compare-args.ts';

test('compare defaults to staging vs this checkout, affected surfaces only', () => {
  assert.deepEqual(parseCompareArgs([]), { base: 'staging', head: 'worktree', all: false, surfaces: null, full: false, plan: false, pruneBases: false });
});

test('compare reads flags in both spellings', () => {
  assert.deepEqual(parseCompareArgs(['--base', 'origin/prod', '--head=staging', '--all', '--full', '--plan', '--surfaces', 'home,league']), {
    base: 'origin/prod', head: 'staging', all: true, surfaces: ['home', 'league'], full: true, plan: true, pruneBases: false,
  });
  assert.equal(parseCompareArgs(['--prune-bases']).pruneBases, true);
});

test('compare refuses --mode and anything unknown', () => {
  assert.throws(() => parseCompareArgs(['--mode', 'production']), /--mode is not accepted/);
  assert.throws(() => parseCompareArgs(['--mode=production']), /--mode is not accepted/);
  assert.throws(() => parseCompareArgs(['--bsae', 'x']), /unknown argument --bsae/);
  assert.throws(() => parseCompareArgs(['--base']), /--base needs a value/);
});

test('capture needs a safe label', () => {
  assert.deepEqual(parseCaptureArgs(['--label', 'after-conclude']), { label: 'after-conclude', target: 'worktree', surfaces: null, full: false });
  assert.throws(() => parseCaptureArgs([]), /--label is required/);
  assert.throws(() => parseCaptureArgs(['--label', '../x']), /--label must be/);
  assert.throws(() => parseCaptureArgs(['--label', 'x', '--mode', 'staging']), /--mode is not accepted/);
});
