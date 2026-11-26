import { test as setup, expect, type Browser } from '@playwright/test';
import { mkdirSync, statSync } from 'node:fs';
import { AUTH_DIR } from '../lib/paths.ts';
import { adminEntry, authFile, guardContext, signInViaUi, stagingBadge } from '../lib/app.ts';
import { loadE2EEnv } from '../lib/env.ts';
import { loadStorageState } from '../lib/storage-state.ts';

const env = loadE2EEnv(['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD', 'E2E_MEMBER_EMAIL', 'E2E_MEMBER_PASSWORD']);
mkdirSync(AUTH_DIR, { recursive: true });

// Firebase throttles password sign-ins per account (TOO_MANY_ATTEMPTS_TRY_LATER), so a saved session is reused for this long.
const REUSE_MAX_AGE_MS = 30 * 60 * 1000;

const isFresh = (file: string): boolean => {
  try { return Date.now() - statSync(file).mtimeMs < REUSE_MAX_AGE_MS; } catch { return false; }
};

// Returns true only when a saved session still lands signed in; it never sends a sign-in request.
async function tryReuse(
  browser: Browser, baseURL: string | undefined, role: 'admin' | 'member', blocked: string[],
): Promise<boolean> {
  const context = await browser.newContext({ storageState: loadStorageState(authFile(role), baseURL), baseURL, serviceWorkers: 'block', reducedMotion: 'reduce' });
  try {
    await guardContext(context, { readOnly: false, blocked });
    const signIns: string[] = [];
    context.on('request', (r) => { if (r.url().includes('accounts:signInWithPassword')) signIns.push(r.url()); });
    const page = await context.newPage();
    await page.goto('/');
    await expect(stagingBadge(page)).toBeVisible();
    try {
      await expect(page.locator('#login-email')).toBeHidden({ timeout: 15_000 });
      await expect(role === 'admin'
        ? adminEntry(page)
        : page.getByText('Standings', { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
    } catch { return false; }
    expect(signIns, 'a reused session must not call signInWithPassword').toEqual([]);
    await context.storageState({ path: authFile(role), indexedDB: true });
    return true;
  } finally {
    await context.close();
  }
}

for (const role of ['admin', 'member'] as const) {
  setup(`sign in as ${role}`, async ({ page, browser, baseURL }, testInfo) => {
    const blocked: string[] = [];
    const noForbidden = () => expect(blocked.filter((b) => b.startsWith('FORBIDDEN')), 'requests to production were attempted').toEqual([]);

    if (process.env.E2E_FRESH_SIGNIN !== '1' && isFresh(authFile(role))) {
      const reused = await tryReuse(browser, baseURL, role, blocked);
      noForbidden();
      if (reused) {
        console.log(`[setup] reused ${role} session on ${new URL(baseURL ?? 'http://127.0.0.1:3100').origin}`);
        testInfo.annotations.push({ type: 'reused session', description: role });
        return;
      }
    }

    await guardContext(page.context(), { readOnly: false, blocked });
    const prefix = role === 'admin' ? 'E2E_ADMIN' : 'E2E_MEMBER';
    await signInViaUi(page, env[`${prefix}_EMAIL`], env[`${prefix}_PASSWORD`]);
    noForbidden();
    await page.context().storageState({ path: authFile(role), indexedDB: true });
  });
}
