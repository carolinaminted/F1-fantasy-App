import { test, expect } from '../fixtures.ts';
import type { Locator, Page } from '@playwright/test';
import { stagingBadge } from '../lib/app.ts';
import { REDIRECTS } from '../lib/redirects.ts';

type Marker = (page: Page) => Locator;
const tab = (name: string): Marker => (page) => page.getByRole('tab', { name, exact: true, selected: true });
const title = (name: string): Marker => (page) => page.getByRole('heading', { level: 1, name, exact: true });

// Something only the target surface shows, so a matching URL over the wrong page still fails.
const SHOWS: Record<string, Marker> = {
  '/race?view=picks': tab('Picks'),
  '/race?view=weekend': tab('Weekend'),
  '/race?view=results': tab('Results'),
  '/standings': title('LEAGUE STANDINGS'),
  '/standings?rules=1': (page) => page.getByRole('dialog', { name: 'Scoring Rules' }),
  '/league': title('LEAGUE'),
  '/league?dues=1': (page) => page.getByRole('dialog').getByRole('heading', { name: 'Pay League Dues', exact: true }),
};

for (const [from, to] of Object.entries(REDIRECTS)) {
  test(`${from} lands on ${to}`, async ({ memberPage, requires }) => {
    // Only the dues sheet depends on dues status; the other redirects must not fail on it.
    await requires('maintenance-off', 'calendar-present', 'member-is-not-admin', ...(to === '/league?dues=1' ? ['member-dues-unpaid' as const] : []));
    await memberPage.goto(from);
    await expect(stagingBadge(memberPage)).toBeVisible();
    await expect.poll(() => { const u = new URL(memberPage.url()); return u.pathname + u.search; }).toBe(to);
    await expect(SHOWS[to](memberPage)).toBeVisible({ timeout: 20_000 });
  });
}
