import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCompareArgs } from '../lib/compare-args.ts';
import { assertAllowedBaseUrl, assertNoProdInEnv, assertStagingEnvFile } from '../lib/guards.ts';
import { classifyTarget, resolveTarget, type Resolved } from '../lib/sides.ts';
import { ensureCheckout, pruneBaseWorktrees } from '../lib/checkouts.ts';
import { startVite, stopAllServers } from '../lib/servers.ts';
import { finalizeRun, printSummary, runName, runPlaywrightCapture, selectionFor } from '../lib/orchestrate.ts';
import { RESULTS_DIR } from '../lib/paths.ts';
import type { SideInfo } from '../lib/report.ts';

// Every guard runs before anything is created, started or launched.
const args = parseCompareArgs(process.argv.slice(2));
assertNoProdInEnv(process.env);
if (process.env.E2E_BASE_URL) assertAllowedBaseUrl(process.env.E2E_BASE_URL);
assertStagingEnvFile();

if (args.pruneBases) {
  const removed = pruneBaseWorktrees();
  console.log(removed.length ? `removed:\n${removed.join('\n')}` : 'no base worktrees to remove');
  process.exit(0);
}

const baseTarget = classifyTarget(args.base);
const headTarget = classifyTarget(args.head);
if (baseTarget.kind === 'worktree') throw new Error('--base must be a git ref or the staging URL');
const base = resolveTarget(baseTarget);
const head = resolveTarget(headTarget);
if (base.kind === 'url' && head.kind === 'url') throw new Error('base and head are both the staging URL; there is nothing to compare');

const describe = (r: Resolved) => (r.kind === 'url' ? r.url : `${r.kind === 'ref' ? r.ref : 'worktree'} @ ${r.sha.slice(0, 8)}${r.kind === 'worktree' && r.dirty ? ' + uncommitted changes' : ''}`);
const selection = selectionFor({ surfaces: args.surfaces, all: args.all, base, head });
console.log(`base: ${describe(base)}\nhead: ${describe(head)}`);
console.log(`selection: ${selection.ids.length} surfaces${selection.all ? ' (all)' : ''}\n  ${selection.reasons.join('\n  ')}`);
console.log(`surfaces: ${selection.ids.join(', ') || 'none'}`);
if (args.plan) process.exit(0);
if (!selection.ids.length) { console.log('nothing to capture'); process.exit(0); }

const startedAt = new Date();
const run = runName(startedAt, args.base, args.head);
const runDir = join(RESULTS_DIR, run);
mkdirSync(join(runDir, 'servers'), { recursive: true });

process.on('SIGINT', () => { void stopAllServers().then(() => process.exit(130)); });

const urlByRoot = new Map<string, string>();
async function serve(r: Resolved, port: number, name: string): Promise<string> {
  if (r.kind === 'url') return r.url;
  const root = r.kind === 'worktree' ? r.root : ensureCheckout(r.sha);
  // Same commit on both sides: one server serves both, which is a pure A/A of the pipeline.
  const existing = urlByRoot.get(root);
  if (existing) return existing;
  const server = await startVite(root, port, join(runDir, 'servers', `${name}.log`));
  urlByRoot.set(root, server.url);
  return server.url;
}

const frozenAt = Date.now();
let headURL = '';
let baseURL = '';
try {
  headURL = await serve(head, 3100, 'head');
  baseURL = await serve(base, 3101, 'base');
  const capture = runPlaywrightCapture({
    runDir, frozenAt, full: args.full, surfaceIds: selection.ids, setupBaseURL: head.kind === 'url' ? baseURL : headURL,
    sides: [{ name: 'base', baseURL }, { name: 'head', baseURL: headURL }],
  });
  if (capture.interrupted) { await stopAllServers(); process.exit(130); }
} finally {
  await stopAllServers();
}

const info = (name: string, target: string, r: Resolved, url: string): SideInfo =>
  r.kind === 'url' ? { name, target, url } : { name, target, sha: r.sha, dirty: r.kind === 'worktree' ? r.dirty : undefined, url };
const report = finalizeRun({ runDir, run, startedAt, frozenAt, selection, sides: [info('base', args.base, base, baseURL), info('head', args.head, head, headURL)] });
printSummary(report, runDir);
// Visual diffs never fail a run; only hard failures do.
process.exit(report.hardFailures.length ? 1 : 0);
