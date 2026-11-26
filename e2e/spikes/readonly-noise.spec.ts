import { test, expect } from '../fixtures.ts';
import type { Page } from '@playwright/test';
import { stagingBadge } from '../lib/app.ts';

// Read-only capture aborts any write the app makes on load. This spike records what that costs
// in console noise, so the allowance in lib/capture-noise.ts covers only what was observed.
const MEMBER_PATHS = ['/', '/race?view=picks', '/race?view=results', '/standings', '/league', '/profile'];
const ADMIN_PATHS = ['/admin', '/admin?tool=season', '/admin?tool=database'];

test.use({ readOnly: true, allowBlockedWriteNoise: true });

async function visit(page: Page, paths: string[]): Promise<void> {
  for (const path of paths) {
    await page.goto(path);
    await expect(stagingBadge(page)).toBeVisible();
    await page.waitForTimeout(4_000);
  }
}

test('member surfaces in read-only mode', async ({ memberPage, blocked }) => {
  await visit(memberPage, MEMBER_PATHS);
  console.log(`[noise] member blocked: ${JSON.stringify(blocked.map((b) => b.replace(/\?.*$/, '')))}`);
});

test('admin surfaces in read-only mode', async ({ adminPage, blocked }) => {
  await visit(adminPage, ADMIN_PATHS);
  console.log(`[noise] admin blocked: ${JSON.stringify(blocked.map((b) => b.replace(/\?.*$/, '')))}`);
});
