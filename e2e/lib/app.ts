import { expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { join } from 'node:path';
import { AUTH_DIR } from './paths.ts';
import { isForbiddenRequestUrl, isWriteRequest } from './guards.ts';

// e2e deliberately imports no app code, so these two keys are re-declared here.
// They mirror constants.ts (session activity) and contexts/ThemeContext.tsx (theme).
export const SESSION_STORAGE_KEY = 'ff1_session_activity';
export const THEME_STORAGE_KEY = 'lol_theme';

export const authFile = (role: 'admin' | 'member'): string => join(AUTH_DIR, `${role}.json`);
export const stagingBadge = (page: Page): Locator => page.getByRole('status', { name: 'Environment: STAGING' });

// Admin is a text button in the desktop side nav and an aria-label="Admin" icon button in the
// mobile header (App.tsx). Both expose role=button with name "Admin".
export const adminEntry = (page: Page): Locator => page.getByRole('button', { name: 'Admin', exact: true });

export async function guardContext(
  context: BrowserContext,
  opts: { readOnly: boolean; blocked: string[] },
): Promise<void> {
  await context.route('**/*', (route) => {
    const req = route.request();
    if (isForbiddenRequestUrl(req.url())) { opts.blocked.push(`FORBIDDEN ${req.url()}`); return route.abort('blockedbyclient'); }
    if (opts.readOnly && isWriteRequest(req.url(), req.method())) { opts.blocked.push(`WRITE ${req.method()} ${req.url()}`); return route.abort('blockedbyclient'); }
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
