import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REDIRECTS } from './redirects.ts';
import { REPO_ROOT } from './paths.ts';

test('the mirrored redirects match routes.ts', () => {
  const source = readFileSync(join(REPO_ROOT, 'routes.ts'), 'utf8');
  const block = /export const REDIRECTS: Record<string, string> = \{([\s\S]*?)\n\};/.exec(source)?.[1];
  assert.ok(block, 'REDIRECTS block not found in routes.ts');
  const actual = Object.fromEntries([...block.matchAll(/'([^']+)':\s*'([^']+)'/g)].map((m) => [m[1], m[2]]));
  assert.deepEqual(REDIRECTS, actual);
});
