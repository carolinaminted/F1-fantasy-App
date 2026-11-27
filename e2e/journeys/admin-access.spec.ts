import { test, expect } from '../fixtures.ts';
import type { Page } from '@playwright/test';
import { adminEntry, stagingBadge } from '../lib/app.ts';
import { ADMIN_TOOLS } from '../surfaces.ts';

// Each admin screen's PageHeader title is its level-1 heading.
const HEADINGS: Record<(typeof ADMIN_TOOLS)[number], string> = {
  results: 'RACE RESULTS',
  'manage-users': 'MEMBERS',
  scoring: 'SCORING RULES',
  entities: 'DRIVERS & TEAMS',
  schedule: 'RACE SCHEDULE',
  invitations: 'INVITE CODES',
  database: 'DATABASE EDITOR',
  announcements: 'ANNOUNCEMENTS',
  season: 'SEASON CONTROL',
};
const SCREENS = [{ path: '/admin', heading: 'ADMIN' }, ...ADMIN_TOOLS.map((tool) => ({ path: `/admin?tool=${tool}`, heading: HEADINGS[tool] }))];

const screenHeading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name, exact: true });
const homeSection = (page: Page) => page.getByRole('heading', { level: 2, name: 'Your Season', exact: true });

for (const screen of SCREENS) {
  test(`${screen.path} shows the admin screen to the admin and Home to a member`, async ({ adminPage, memberPage, requires }) => {
    test.setTimeout(60_000);
    await requires('maintenance-off', 'calendar-present', 'member-is-not-admin', 'admin-is-admin');

    // Control first: proves the heading can be found when the screen really renders.
    await adminPage.goto(screen.path);
    await expect(stagingBadge(adminPage)).toBeVisible();
    await expect(screenHeading(adminPage, screen.heading)).toBeVisible({ timeout: 20_000 });

    await memberPage.goto(screen.path);
    await expect(stagingBadge(memberPage)).toBeVisible();
    await expect(homeSection(memberPage)).toBeVisible({ timeout: 20_000 });
    await expect(screenHeading(memberPage, screen.heading)).toHaveCount(0);
    await expect(adminEntry(memberPage)).toHaveCount(0);
  });
}
