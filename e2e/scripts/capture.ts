import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseCaptureArgs } from '../lib/compare-args.ts';
import { assertAllowedBaseUrl, assertNoProdInEnv, assertStagingEnvFile } from '../lib/guards.ts';
import { classifyTarget, resolveTarget } from '../lib/sides.ts';
import { ensureCheckout } from '../lib/checkouts.ts';
import { startVite, stopAllServers } from '../lib/servers.ts';
import { finalizeRun, printSummary, runName, runPlaywrightCapture, selectionFor } from '../lib/orchestrate.ts';
import { RESULTS_DIR } from '../lib/paths.ts';

// One side, labeled, for a rollover step; the gallery shows the shots without diffs.
const args = parseCaptureArgs(process.argv.slice(2));
assertNoProdInEnv(process.env);
if (process.env.E2E_BASE_URL) assertAllowedBaseUrl(process.env.E2E_BASE_URL);
assertStagingEnvFile();

const target = resolveTarget(classifyTarget(args.target));
const selection = selectionFor({ surfaces: args.surfaces, all: !args.surfaces, base: target, head: target });
const startedAt = new Date();
const run = runName(startedAt, `capture-${args.label}`, args.target);
const runDir = join(RESULTS_DIR, run);
mkdirSync(join(runDir, 'servers'), { recursive: true });

let url = '';
const frozenAt = Date.now();
process.on('SIGINT', () => { void stopAllServers().then(() => process.exit(130)); });
try {
  if (target.kind === 'url') url = target.url;
  else {
    const server = await startVite(target.kind === 'worktree' ? target.root : ensureCheckout(target.sha), 3100, join(runDir, 'servers', `${args.label}.log`));
    url = server.url;
  }
  const capture = runPlaywrightCapture({ runDir, frozenAt, full: args.full, surfaceIds: selection.ids, setupBaseURL: url, sides: [{ name: args.label, baseURL: url }] });
  if (capture.interrupted) { await stopAllServers(); process.exit(130); }
} finally {
  await stopAllServers();
}

const report = finalizeRun({
  runDir, run, startedAt, frozenAt, selection,
  sides: [target.kind === 'url' ? { name: args.label, target: args.target, url } : { name: args.label, target: args.target, sha: target.sha, url }],
});
printSummary(report, runDir);
process.exit(report.hardFailures.length ? 1 : 0);
