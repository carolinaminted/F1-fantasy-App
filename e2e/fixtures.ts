import { test as base, expect, type Browser, type Page } from '@playwright/test';
import { authFile, guardContext, SESSION_STORAGE_KEY } from './lib/app.ts';
import { RACE_RESULTS_SEED_NOTE, splitKnownIssues } from './lib/known-issues.ts';

type Allowance = { re: RegExp; used: boolean };

type Fixtures = {
  readOnly: boolean;
  blocked: string[];
  writeBodies: string[];
  pageErrors: string[];
  allowances: Allowance[];
  expectError: (re: RegExp) => void;
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
  writeBodies: string[];
  pageErrors: string[];
};

async function openPage(env: PageEnv, role?: 'member' | 'admin'): Promise<Page> {
  const context = await env.browser.newContext({
    storageState: role ? authFile(role) : undefined,
    viewport: env.viewport,
    isMobile: env.isMobile,
    hasTouch: env.hasTouch,
    baseURL: env.baseURL,
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  });
  await guardContext(context, { readOnly: env.readOnly, blocked: env.blocked, writeBodies: env.writeBodies });
  await context.addInitScript((key) => localStorage.setItem(key, String(Date.now())), SESSION_STORAGE_KEY);
  const page = await context.newPage();
  page.on('pageerror', (e) => env.pageErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') env.pageErrors.push(`console.error: ${m.text()}`); });
  return page;
}

export const test = base.extend<Fixtures>({
  readOnly: [false, { option: true }],
  blocked: async ({}, use, testInfo) => {
    const blocked: string[] = [];
    await use(blocked);
    const forbidden = blocked.filter((b) => b.startsWith('FORBIDDEN'));
    if (forbidden.length) testInfo.annotations.push({ type: 'forbidden-requests', description: forbidden.join('\n') });
    expect(forbidden, 'requests to production were attempted').toEqual([]);
  },
  allowances: async ({}, use) => { await use([]); },
  expectError: async ({ allowances }, use) => {
    await use((re) => { allowances.push({ re, used: false }); });
  },
  writeBodies: async ({}, use) => { await use([]); },
  pageErrors: async ({ allowances, writeBodies }, use, testInfo) => {
    const errors: string[] = [];
    await use(errors);
    // Optional, may match zero times (the bug is intermittent); unlike expectError it never fails when unused.
    const known = splitKnownIssues(errors, writeBodies);
    if (known.knownHit) testInfo.annotations.push({ type: 'known-app-issue', description: RACE_RESULTS_SEED_NOTE.replace('known-app-issue: ', '') });
    const unexpected = known.remaining.filter((e) => {
      const hits = allowances.filter((a) => a.re.test(e));
      hits.forEach((a) => { a.used = true; });
      return hits.length === 0;
    });
    expect(unexpected, 'page errors or console.error during the test').toEqual([]);
    expect(allowances.filter((a) => !a.used).map((a) => String(a.re)), 'expectError patterns that never matched').toEqual([]);
  },
  memberPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors }, use) => {
    const page = await openPage({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors }, 'member');
    await use(page);
    await page.context().close();
  },
  adminPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors }, use) => {
    const page = await openPage({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors }, 'admin');
    await use(page);
    await page.context().close();
  },
  anonPage: async ({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors }, use) => {
    const page = await openPage({ browser, viewport, isMobile, hasTouch, baseURL, readOnly, blocked, writeBodies, pageErrors });
    await use(page);
    await page.context().close();
  },
});

export { expect };
