import { test, expect } from '../fixtures.ts';
import { adminEntry, stagingBadge } from '../lib/app.ts';
import { ADMIN_TOOLS } from '../surfaces.ts';

const PATHS = ['/', '/race?view=picks', '/standings', '/league', '/league?dues=1', '/profile', '/admin',
  ...ADMIN_TOOLS.map((tool) => `/admin?tool=${tool}`)];
// Display names of the two provisioned accounts: member data that must never render signed out.
const MEMBER_NAMES = /E2E (Member|Admin)/;
const APP_HEADINGS = /^(ADMIN|MEMBERS|DATABASE EDITOR|LEAGUE STANDINGS|LEAGUE|PROFILE|Your Season)$/;

test('control: a signed-in member does see member names', async ({ memberPage, requires }) => {
  await requires('maintenance-off', 'calendar-present');
  await memberPage.goto('/standings');
  await expect(memberPage.getByText(MEMBER_NAMES).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
});

for (const path of PATHS) {
  test(`signed out, ${path} shows only sign-in`, async ({ anonPage }) => {
    await anonPage.goto(path);
    await expect(stagingBadge(anonPage)).toBeVisible();
    await expect(anonPage.locator('#login-email')).toBeVisible();
    // Absence only means something once a late data render has had its chance to appear.
    await anonPage.waitForTimeout(1_500);
    await expect(anonPage.getByText(MEMBER_NAMES)).toHaveCount(0);
    await expect(anonPage.getByRole('heading', { name: APP_HEADINGS })).toHaveCount(0);
    await expect(adminEntry(anonPage)).toHaveCount(0);
    await expect(anonPage.getByRole('button', { name: 'Log In', exact: true })).toBeVisible();
  });
}
