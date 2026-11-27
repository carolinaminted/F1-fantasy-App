import { test, expect } from '../fixtures.ts';
import type { Page } from '@playwright/test';
import { SESSION_STORAGE_KEY, stagingBadge } from '../lib/app.ts';

const signedIn = (page: Page) => expect(page.locator('#login-email')).toBeHidden({ timeout: 30_000 });
const signedOut = (page: Page) => expect(page.locator('#login-email')).toBeVisible({ timeout: 20_000 });

async function logOut(page: Page): Promise<void> {
  if (test.info().project.name === 'desktop') {
    // The sidebar account button: name, rank and points. Scoped to the sidebar because the dashboard's rank tiles also end in "pts".
    await page.getByRole('complementary').getByRole('button', { name: /pts$/ }).click();
  }
  await page.getByRole('button', { name: 'Log Out', exact: true }).click();
}

for (const role of ['member', 'admin'] as const) {
  test(`${role} signs out and stays signed out after a reload`, async ({ memberPage, adminPage, requires }) => {
    await requires('maintenance-off', 'calendar-present');
    const page = role === 'member' ? memberPage : adminPage;
    await page.goto('/');
    await expect(stagingBadge(page)).toBeVisible();
    await signedIn(page);
    await logOut(page);
    await signedOut(page);
    expect(await page.evaluate((k) => localStorage.getItem(k), SESSION_STORAGE_KEY)).toBeNull();
    await page.reload();
    await signedOut(page);
  });
}

test.describe('idle session', () => {
  test('after 10 idle minutes the member is asked, and Continue Session keeps them in', async ({ memberPage: page, requires }) => {
    await requires('maintenance-off', 'calendar-present');
    await page.goto('/');
    await signedIn(page);
    // Timers keep running under setFixedTime; the guard compares Date.now() with the last activity every second.
    await page.clock.setFixedTime(Date.now() + 11 * 60_000);
    await expect(page.getByRole('heading', { level: 2, name: 'Are you still there?' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Continue Session', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Are you still there?' })).toBeHidden();
    await signedIn(page);
  });

  test('after 15 idle minutes the member is signed out with a notice', async ({ memberPage: page, requires }) => {
    await requires('maintenance-off', 'calendar-present');
    await page.goto('/');
    await signedIn(page);
    await page.clock.setFixedTime(Date.now() + 16 * 60_000);
    await expect(page.getByRole('alert').filter({ hasText: 'Your session has expired. Please log in again.' })).toBeVisible({ timeout: 10_000 });
    await signedOut(page);
  });
});
