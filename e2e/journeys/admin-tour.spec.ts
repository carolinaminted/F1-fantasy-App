import { test, expect } from '../fixtures.ts';
import type { Page } from '@playwright/test';

// Dashboard tile title → the tool's level-1 heading. Database Manager has no tile.
const TILES: [string, string][] = [
  ['Enter Race Results', 'RACE RESULTS'],
  ['Race Schedule', 'RACE SCHEDULE'],
  ['Members', 'MEMBERS'],
  ['Invite Codes', 'INVITE CODES'],
  ['Drivers & Teams', 'DRIVERS & TEAMS'],
  ['Scoring Rules', 'SCORING RULES'],
  ['Season Control', 'SEASON CONTROL'],
  ['Announcements & Red Flag', 'ANNOUNCEMENTS'],
];
const h1 = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });

test('admin opens each tool from its dashboard tile and returns', async ({ adminPage: page, requires }) => {
  test.setTimeout(120_000);
  await requires('maintenance-off', 'calendar-present', 'admin-is-admin');
  const desktop = test.info().project.name === 'desktop';

  await page.goto('/admin');
  for (const [tile, heading] of TILES) {
    await expect(h1(page, 'ADMIN')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('heading', { level: 3, name: tile, exact: true }).click();
    await expect(h1(page, heading), `${tile} opens ${heading}`).toBeVisible({ timeout: 20_000 });
    // "Admin Home" is in PageHeader's leftAction, shown from md up; mobile uses the browser back.
    if (desktop) await page.getByRole('button', { name: 'Admin Home' }).click();
    else await page.goBack();
  }
  await expect(h1(page, 'ADMIN')).toBeVisible();
});
