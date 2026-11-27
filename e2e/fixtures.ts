import { test as base, expect, type Browser, type Page } from '@playwright/test';
import { authFile, guardContext, SESSION_STORAGE_KEY } from './lib/app.ts';
import { loadStorageState } from './lib/storage-state.ts';
import { dropBlockedWriteNoise } from './lib/capture-noise.ts';
import { RACE_RESULTS_SEED_NOTE, splitKnownIssues } from './lib/known-issues.ts';
import { assertWriteAllowed } from './lib/run-mode.ts';

type Allowance = { re: RegExp; used: boolean };

type Fixtures = {
  readOnly: boolean;
  allowBlockedWriteNoise: boolean;
  writeGate: void;
  blocked: string[];
  writeBodies: Map<string, string[]>;
  pageErrors: string[];
  errorPages: string[];
  allowances: Allowance[];
  blockedAllowances: Allowance[];
  expectError: (re: RegExp) => void;
  expectBlocked: (re: RegExp) => void;
  memberPage: Page;
  adminPage: Page;
  anonPage: Page;
};

type PageEnv = {
  browser: Browser;
  viewport: { width: number; height: number } | null;
  isMobile: boolean;
  hasTouch: boolean;
  baseURL?: string;
  readOnly: boolean;
  blocked: string[];
  writeBodies: Map<string, string[]>;
  pageErrors: string[];
  errorPages: string[];
};

async function openPage(env: PageEnv, role?: 'member' | 'admin'): Promise<Page> {
  const context = await env.browser.newContext({
    storageState: role ? loadStorageState(authFile(role), env.baseURL) : undefined,
    viewport: env.viewport,
    isMobile: env.isMobile,
    hasTouch: env.hasTouch,
    baseURL: env.baseURL,
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  });
  // Errors and write bodies share this id so a known-issue excuse never crosses pages.
  const pageId = `${role ?? 'anon'}#${env.writeBodies.size}`;
  const bodies: string[] = [];
  env.writeBodies.set(pageId, bodies);
  await guardContext(context, { readOnly: env.readOnly, blocked: env.blocked, writeBodies: bodies });
  await context.addInitScript((key) => localStorage.setItem(key, String(Date.now())), SESSION_STORAGE_KEY);
  const page = await context.newPage();
  const record = (text: string) => { env.pageErrors.push(text); env.errorPages.push(pageId); };
  page.on('pageerror', (e) => record(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') record(`console.error: ${m.text()}`); });
  return page;
}

export const test = base.extend<Fixtures>({
  // The built-in page/context go through the same guard as openPage; the built-in request is unguarded, so it is closed off.
  context: async ({ context, readOnly, blocked }, use) => {
    await guardContext(context, { readOnly, blocked });
    await use(context);
  },
  request: async ({}, use) => {
    await use(new Proxy({}, { get() { throw new Error('the built-in request fixture is unguarded; use lib/staging-admin.ts for API calls'); } }) as never);
  },
  readOnly: [true, { option: true }],
  allowBlockedWriteNoise: [true, { option: true }],
  writeGate: [async ({ readOnly }, use) => { assertWriteAllowed(readOnly); await use(); }, { auto: true }],
  blockedAllowances: async ({}, use) => { await use([]); },
  expectBlocked: async ({ blockedAllowances, blocked: _blocked }, use) => {
    await use((re) => { blockedAllowances.push({ re, used: false }); });
  },
  blocked: async ({ blockedAllowances }, use, testInfo) => {
    const blocked: string[] = [];
    await use(blocked);
    const forbidden = blocked.filter((b) => b.startsWith('FORBIDDEN'));
    if (forbidden.length) testInfo.annotations.push({ type: 'forbidden-requests', description: forbidden.join('\n') });
    const unexpected = forbidden.filter((b) => {
      const hits = blockedAllowances.filter((a) => a.re.test(b));
      hits.forEach((a) => { a.used = true; });
      return hits.length === 0;
    });
    expect(unexpected, 'requests to production were attempted').toEqual([]);
    expect(blockedAllowances.filter((a) => !a.used).map((a) => String(a.re)), 'expectBlocked patterns that never matched').toEqual([]);
  },
  allowances: async ({}, use) => { await use([]); },
  expectError: async ({ allowances, pageErrors: _pageErrors }, use) => {
    await use((re) => { allowances.push({ re, used: false }); });
  },
  writeBodies: async ({}, use) => { await use(new Map()); },
  errorPages: async ({}, use) => { await use([]); },
  pageErrors: async ({ allowances, writeBodies, errorPages, blocked, allowBlockedWriteNoise }, use, testInfo) => {
    const errors: string[] = [];
    await use(errors);
    // Optional, may match zero times (the bug is intermittent); unlike expectError it never fails when unused.
    const known = splitKnownIssues(errors.map((text, i) => ({ text, pageId: errorPages[i] })), writeBodies);
    if (known.knownHit) testInfo.annotations.push({ type: 'known-app-issue', description: RACE_RESULTS_SEED_NOTE.replace('known-app-issue: ', '') });
    // Declared allowances are matched first, so the noise filter cannot swallow a line a test expects.
    let unexpected = known.remaining.map((r) => r.text).filter((e) => {
      const hits = allowances.filter((a) => a.re.test(e));
      hits.forEach((a) => { a.used = true; });
      return hits.length === 0;
    });
    if (allowBlockedWriteNoise) {
      const noise = dropBlockedWriteNoise(unexpected, blocked);
      if (noise.dropped) testInfo.annotations.push({ type: 'blocked-write-noise', description: `${noise.dropped} log line(s) from aborted writes` });
      unexpected = noise.remaining;
    }
    expect(unexpected, 'page errors or console.error during the test').toEqual([]);
    expect(allowances.filter((a) => !a.used).map((a) => String(a.re)), 'expectError patterns that never matched').toEqual([]);
  },
  memberPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors, errorPages }, use) => {
    const page = await openPage({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors, errorPages }, 'member');
    await use(page);
    await page.context().close();
  },
  adminPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors, errorPages }, use) => {
    const page = await openPage({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors, errorPages }, 'admin');
    await use(page);
    await page.context().close();
  },
  anonPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors, errorPages }, use) => {
    const page = await openPage({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors, errorPages });
    await use(page);
    await page.context().close();
  },
});

export { expect };
