import { test, expect } from '../fixtures.ts';
import { MEMBER_EMAIL } from '../lib/identities.ts';
import { getDoc, uidOf } from '../lib/staging-admin.ts';
import { fillEmptySlots, lockIn } from '../lib/picks-ui.ts';

type Lineup = Record<string, unknown>;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Events in userPicks/{uid} that carry a submittedAt, keyed by event id.
async function submitted(uid: string): Promise<Record<string, Lineup>> {
  const doc = (await getDoc(`userPicks/${uid}`)) ?? {};
  return Object.fromEntries(Object.entries(doc).filter(([, v]) => !!v && typeof v === 'object' && 'submittedAt' in (v as object))) as Record<string, Lineup>;
}
const withoutTime = ({ submittedAt: _t, ...rest }: Lineup) => JSON.stringify(rest);

test.describe('picks', () => {
  test.use({ readOnly: false });

  test('member makes picks, sees them on Profile and Home, then edits them', { tag: '@write' }, async ({ memberPage: page, requires, restoring }) => {
    test.skip(test.info().project.name !== 'desktop', 'one write per run: desktop only');
    test.setTimeout(180_000);
    await requires('maintenance-off', 'calendar-present', 'season-active', 'member-is-not-admin');

    const uid = await uidOf(MEMBER_EMAIL);
    await restoring([`userPicks/${uid}`]);
    const before = await submitted(uid);

    await page.goto('/race?view=picks');
    const form = page.getByRole('heading', { level: 3, name: 'Class A Teams' });
    const edit = page.getByRole('button', { name: 'Edit Picks', exact: true });
    // A leftover submission opens on its confirmation screen; edit it so the test always starts from the form.
    await expect(form.or(edit)).toBeVisible({ timeout: 20_000 });
    if (await edit.isVisible()) await edit.click();
    await expect(form).toBeVisible();
    await fillEmptySlots(page);
    const eventName = await lockIn(page);

    let eventId = '';
    await expect.poll(async () => {
      const now = await submitted(uid);
      eventId = Object.keys(now).find((id) => !before[id] || JSON.stringify(before[id]) !== JSON.stringify(now[id])) ?? '';
      return eventId;
    }, { timeout: 20_000, message: 'a submitted lineup with submittedAt reaches userPicks' }).not.toBe('');
    const first = (await submitted(uid))[eventId];
    expect((first.aDrivers as unknown[]).filter(Boolean)).toHaveLength(3);

    // Seen afterwards: Profile history and Home's chip (League and Standings do not show a member's own picks).
    await page.goto('/profile');
    const row = page.getByRole('button', { name: new RegExp(`R\\d+: ${escape(eventName)}`) });
    await row.click();
    await expect(page.getByText(/^Submitted /).first()).toBeVisible();
    await page.goto('/');
    await expect(page.getByText('Lineup submitted', { exact: true })).toBeVisible({ timeout: 20_000 });

    // Edit: clear one pick, choose a different one, lock in again.
    await page.goto('/race?view=picks');
    await page.getByRole('button', { name: 'Edit Picks', exact: true }).click();
    const clear = page.getByRole('button', { name: /^Clear / }).first();
    const cleared = (await clear.getAttribute('aria-label'))!.slice('Clear '.length);
    await clear.click();
    await fillEmptySlots(page, [cleared]);
    await lockIn(page);
    await expect.poll(async () => withoutTime((await submitted(uid))[eventId] ?? {}), { timeout: 20_000, message: 'the edited lineup is stored' })
      .not.toBe(withoutTime(first));
  });
});
