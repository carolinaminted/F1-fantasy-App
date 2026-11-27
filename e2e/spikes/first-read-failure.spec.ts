import { test, expect } from '../fixtures.ts';
import { LOADING_PLACEHOLDER } from '../lib/capture.ts';
import { firestoreOutage } from '../lib/firestore-outage.ts';
import { redactKey } from '../lib/guards.ts';

// App.tsx logs this when the one-shot league read rejects.
const LEAGUE_READ_FAILED = 'Failed to fetch leaderboard data';

for (const path of ['/', '/standings']) {
  test(`spike J12: ${path} recovers without reload after the first Firestore reads fail`, async ({ memberPage, expectError, requires }) => {
    test.setTimeout(150_000);
    await requires('maintenance-off', 'calendar-present', 'member-is-not-admin');
    // An outage logs errors by design; they are printed below instead of failing the spike.
    expectError(/^(console\.error|pageerror): /);
    const seen: string[] = [];
    memberPage.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') seen.push(`${m.type()}: ${redactKey(m.text()).slice(0, 160)}`); });
    let loads = 0;
    memberPage.on('load', () => { loads++; });

    const outage = await firestoreOutage(memberPage);
    // A spike that fails still has to say what it saw.
    try {
      await memberPage.goto(path);
      await expect.poll(() => seen.some((t) => t.includes(LEAGUE_READ_FAILED)), { message: 'the league read failed during the outage', timeout: 45_000 }).toBe(true);
      outage.restore();
      const restoredAt = Date.now();
      await expect(memberPage.getByText('E2E Member').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
      await expect(memberPage.locator(LOADING_PLACEHOLDER).filter({ visible: true })).toHaveCount(0, { timeout: 20_000 });
      expect(loads, 'recovered without a reload').toBe(1);
      console.log(`[spike J12] ${path}: recovered ${Date.now() - restoredAt} ms after restore`);
    } finally {
      console.log(`[spike J12] ${path}: ${outage.aborted()} requests aborted; distinct console lines:\n${[...new Set(seen)].join('\n') || '(none)'}`);
    }
  });
}
