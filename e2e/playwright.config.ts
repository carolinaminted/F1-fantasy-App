import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';
import { join, resolve, sep } from 'node:path';
import { assertAllowedBaseUrl, assertNoProdInEnv, assertStagingEnvFile, GuardError, resolveBaseUrl } from './lib/guards.ts';
import { parseSides } from './lib/capture-plan.ts';
import { RESULTS_DIR } from './lib/paths.ts';
import { spikesEnabled, writesEnabled } from './lib/run-mode.ts';

// Web servers start before globalSetup, so the guards must also run at config load.
assertNoProdInEnv(process.env);
assertStagingEnvFile();
const baseURL = resolveBaseUrl(process.env.E2E_BASE_URL);
const local = new URL(baseURL).hostname !== 'f1.staging.carolinaminted.net';
const port = new URL(baseURL).port || '3100';

// Capture projects exist only when compare.ts or capture.ts pass sides; journeys never see them.
const sides = parseSides(process.env.E2E_SIDES);
for (const s of sides) assertAllowedBaseUrl(s.baseURL);
const runDir = process.env.E2E_RUN_DIR;
if (sides.length) {
  if (!runDir || !resolve(runDir).startsWith(RESULTS_DIR + sep)) throw new GuardError('E2E_RUN_DIR must be a folder under e2e-results/ when E2E_SIDES is set');
  if (!Number.isFinite(Number(process.env.E2E_FROZEN_AT))) throw new GuardError('E2E_FROZEN_AT (epoch ms) is required when E2E_SIDES is set');
}
// compare.ts starts its own servers with --mode staging; the request guards and the STAGING badge check still apply.
const managed = process.env.E2E_SERVERS_MANAGED === '1';

// Chromium text antialiasing differs run to run (subpixel positioning, LCD smoothing); these flags make glyph edges deterministic.
const CHROMIUM_STABLE_TEXT = ['--font-render-hinting=none', '--disable-lcd-text', '--disable-font-subpixel-positioning', '--force-color-profile=srgb'];
const capture = (name: string, use: PlaywrightTestConfig['use']) => ({
  name, testMatch: /capture\.spec\.ts/, dependencies: ['setup'],
  use: use?.browserName === 'chromium' ? { ...use, launchOptions: { args: CHROMIUM_STABLE_TEXT } } : use,
});
const captureProjects = sides.length ? [
  capture('capture-desktop', { browserName: 'chromium', viewport: { width: 1440, height: 1000 } }),
  capture('capture-mobile', { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }),
  ...(process.env.E2E_FULL === '1'
    ? [capture('capture-webkit-mobile', { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })]
    : []),
] : [];

const DESKTOP: PlaywrightTestConfig['use'] = { browserName: 'chromium', viewport: { width: 1440, height: 1000 } };
const MOBILE: PlaywrightTestConfig['use'] = { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
// Tests tagged @write change staging, so they are left out unless E2E_WRITES=1.
const journeys = (name: string, use: PlaywrightTestConfig['use']) => ({
  name, testMatch: /journeys\/.*\.spec\.ts/, grepInvert: writesEnabled() ? undefined : /@write/, dependencies: ['setup'], use,
});

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: sides.length ? Number(process.env.E2E_WORKERS ?? 2) : 1,
  retries: 0,
  outputDir: runDir && sides.length ? join(runDir, 'test-output') : '../e2e-results/test-output',
  reporter: runDir && sides.length
    ? [['list'], ['json', { outputFile: join(runDir, 'playwright.json') }]]
    : [['list'], ['html', { outputFolder: '../e2e-results/report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    journeys('desktop', DESKTOP),
    journeys('mobile', MOBILE),
    // Proofs that the harness itself works. testDir, not a testMatch regex: regexes see the absolute
    // path, and the worktree folder lol-e2e-harness/ would make every spec match.
    { name: 'harness', testDir: './harness', dependencies: ['setup'], use: DESKTOP },
    // Questions being answered; they may be slow or fail. Only defined when asked for.
    ...(spikesEnabled() ? [{ name: 'spikes', testMatch: /spikes\/.*\.spec\.ts/, dependencies: ['setup'], use: DESKTOP }] : []),
    ...captureProjects,
  ],
  // reuseExistingServer is false on purpose: a stray Vite on this port in another mode could point at production.
  webServer: local && !managed
    ? { command: `npm --prefix .. run dev -- --mode staging --host 127.0.0.1 --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false, timeout: 90_000 }
    : undefined,
});
