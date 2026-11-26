import { defineConfig } from '@playwright/test';
import { assertNoProdInEnv, assertStagingEnvFile, resolveBaseUrl } from './lib/guards.ts';

// Web servers start before globalSetup, so the guards must also run at config load.
assertNoProdInEnv(process.env);
assertStagingEnvFile();
const baseURL = resolveBaseUrl(process.env.E2E_BASE_URL);
const local = new URL(baseURL).hostname !== 'f1.staging.carolinaminted.net';
const port = new URL(baseURL).port || '3100';

export default defineConfig({
  testDir: '.',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: '../e2e-results/test-output',
  reporter: [['list'], ['html', { outputFolder: '../e2e-results/report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    serviceWorkers: 'block',
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    { name: 'desktop', testMatch: /(journeys|spikes)\/.*\.spec\.ts/, dependencies: ['setup'], use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', testMatch: /(journeys|spikes)\/.*\.spec\.ts/, dependencies: ['setup'], use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  // reuseExistingServer is false on purpose: a stray Vite on this port in another mode could point at production.
  webServer: local
    ? { command: `npm --prefix .. run dev -- --mode staging --host 127.0.0.1 --port ${port} --strictPort`, url: baseURL, reuseExistingServer: false, timeout: 90_000 }
    : undefined,
});
