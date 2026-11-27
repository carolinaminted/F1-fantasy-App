import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { join } from 'node:path';
import { AUTH_DIR } from './paths.ts';
import { GuardError, isForbiddenRequestUrl, isForeignFirebaseAuthKey, isWriteRequest, redactKey, stagingWebApiKey } from './guards.ts';
import { isFirestoreWriteBody } from './known-issues.ts';
import { isWriteHandshakeOnly } from './write-channel.ts';

// e2e deliberately imports no app code, so these two keys are re-declared here.
// They mirror constants.ts (session activity) and contexts/ThemeContext.tsx (theme).
export const SESSION_STORAGE_KEY = 'ff1_session_activity';
export const THEME_STORAGE_KEY = 'lol_theme';
export const SESSION_PIN_KEY = 'e2e_session_pin';

// Runs in the page on every load and marks the session active. A test that moves the clock first
// stores its latest time under both keys, so the app's idle guard never sees a gap and signs out.
export const stampSession = ([key, pin]: string[]): void => {
  // about:blank has no storage, and the thrown error would fail the test.
  if (location.protocol.startsWith('http')) localStorage.setItem(key, localStorage.getItem(pin) ?? String(Date.now()));
};

export const authFile = (role: 'admin' | 'member'): string => join(AUTH_DIR, `${role}.json`);
export const stagingBadge = (page: Page): Locator => page.getByRole('status', { name: 'Environment: STAGING' });

// Admin is a text button in the desktop side nav and an aria-label="Admin" icon button in the
// mobile header (App.tsx). Both expose role=button with name "Admin".
export const adminEntry = (page: Page): Locator => page.getByRole('button', { name: 'Admin', exact: true });

// page.request, context.request and route.fetch share one object that context.route never sees.
// Only its sending methods are replaced: context.close() still needs the rest of it.
export function closeApiRequests(context: BrowserContext): void {
  const refuse = async (): Promise<never> => {
    throw new GuardError('page.request, context.request and route.fetch bypass the request guard; use lib/staging-admin.ts for API calls');
  };
  for (const method of ['fetch', '_innerFetch']) Object.defineProperty(context.request, method, { value: refuse, configurable: true });
}

export async function guardContext(
  context: BrowserContext,
  opts: { readOnly: boolean; blocked: string[]; writeBodies?: string[]; allowWriteHandshake?: boolean },
): Promise<void> {
  closeApiRequests(context);
  const stagingKey = stagingWebApiKey();
  await context.route('**/*', (route) => {
    const req = route.request();
    if (isForbiddenRequestUrl(req.url()) || isForeignFirebaseAuthKey(req.url(), stagingKey)) { opts.blocked.push(`FORBIDDEN ${redactKey(req.url())}`); return route.abort('blockedbyclient'); }
    // Kept in memory only, for the known-issue check in fixtures.ts; never logged.
    if (opts.writeBodies && isWriteRequest(req.url(), req.method()) && isFirestoreWriteBody(req.url())) {
      opts.writeBodies.push(req.postData() ?? '');
    }
    if (opts.readOnly && isWriteRequest(req.url(), req.method())) {
      // The handshake is let through only for tests that need to see which documents a write names.
      if (opts.allowWriteHandshake && req.url().includes('/google.firestore.v1.Firestore/Write/') && isWriteHandshakeOnly(req.postData() ?? '')) return route.continue();
      opts.blocked.push(`WRITE ${req.method()} ${req.url()}`); return route.abort('blockedbyclient');
    }
    return route.continue();
  });
}

export async function signInViaUi(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/');
  await expect(stagingBadge(page)).toBeVisible();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(page.locator('#login-email')).toBeHidden({ timeout: 30_000 });
  await expect(stagingBadge(page)).toBeVisible();
}
