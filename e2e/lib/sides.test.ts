import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTarget } from './sides.ts';

test('worktree, refs and the staging URL are recognised', () => {
  assert.deepEqual(classifyTarget('worktree'), { kind: 'worktree' });
  assert.deepEqual(classifyTarget('origin/prod'), { kind: 'ref', ref: 'origin/prod' });
  assert.deepEqual(classifyTarget('HEAD~1'), { kind: 'ref', ref: 'HEAD~1' });
  assert.deepEqual(classifyTarget('https://f1.staging.carolinaminted.net/'), { kind: 'url', url: 'https://f1.staging.carolinaminted.net' });
});

test('production and local URLs are refused', () => {
  assert.throws(() => classifyTarget('https://f1.carolinaminted.net'), (e: Error) => e.name === 'GuardError');
  assert.throws(() => classifyTarget('http://127.0.0.1:3100'), /must be https:\/\/f1\.staging\.carolinaminted\.net/);
});

test('things that are not refs are refused', () => {
  assert.throws(() => classifyTarget('-rf'), /not a git ref/);
  assert.throws(() => classifyTarget('a b'), /not a git ref/);
});
