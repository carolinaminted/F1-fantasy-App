import { test, expect } from '../fixtures.ts';
import { stagingBadge } from '../lib/app.ts';

const FROZEN = new Date(Number(process.env.E2E_FROZEN_AT ?? Date.now()));

test('a fixed clock keeps auth, listeners and rendering working', async ({ memberPage }) => {
  await memberPage.clock.setFixedTime(FROZEN);
  await memberPage.goto('/');
  await expect(stagingBadge(memberPage)).toBeVisible();
  await expect(memberPage.locator('#login-email')).toBeHidden();
  // The season label is not rendered on Home while the season is active, so assert listener-fed data instead:
  // the calendar-driven next-race heading and a standings row (both arrive via Firestore).
  await expect(memberPage.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(memberPage.getByText('E2E Member').first()).toBeVisible({ timeout: 20_000 });
  const a = await memberPage.evaluate(() => Date.now());
  await memberPage.waitForTimeout(1_500);
  const b = await memberPage.evaluate(() => Date.now());
  expect(b).toBe(a);
  await memberPage.reload();
  await expect(memberPage.locator('#login-email')).toBeHidden();
});
