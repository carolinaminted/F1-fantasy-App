import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Report } from '../lib/report.ts';
import { runLine } from '../lib/last-run.ts';

// Run from the repo root (release-gates.sh cds there). Results are per checkout: a worktree's runs live in its own e2e-results/.
const sha = process.argv[2];
if (!/^[0-9a-f]{40}$/.test(sha ?? '')) {
  console.error('usage: last-run.ts <full commit sha>');
  process.exit(2);
}
const dir = 'e2e-results';
const reports: Report[] = existsSync(dir)
  ? readdirSync(dir).map((d) => join(dir, d, 'report.json')).filter((f) => existsSync(f)).map((f) => JSON.parse(readFileSync(f, 'utf8')))
  : [];
console.log(runLine(reports, sha));
