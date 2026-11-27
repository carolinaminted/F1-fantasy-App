import { test, expect } from '../fixtures.ts';
import { MEMBER_EMAIL, newRunId } from '../lib/identities.ts';
import { getDoc, uidOf } from '../lib/staging-admin.ts';
import { restoreDocs, snapshotDocs } from '../lib/snapshot.ts';
import { fieldByText } from '../lib/ui.ts';

test.describe('profile', () => {
  test.use({ readOnly: false });

  test('member edits their display name and sees it saved', { tag: '@write' }, async ({ memberPage: page, requires }) => {
    test.skip(test.info().project.name !== 'desktop', 'one write per run: desktop only');
    test.setTimeout(120_000);
    await requires('maintenance-off', 'calendar-present', 'member-is-not-admin');

    const uid = await uidOf(MEMBER_EMAIL);
    const snapshot = await snapshotDocs([`users/${uid}`, `public_users/${uid}`]);
    const newName = `E2E M ${newRunId().slice(0, 6)}`; // display names are at most 20 characters
    try {
      await page.goto('/profile');
      await page.getByRole('button', { name: 'Manage Account', exact: true }).click();
      await page.getByRole('button', { name: 'Edit Details', exact: true }).click();
      // The provisioned first name "E2E" holds a digit, which the form's own real-name check rejects on every save; restored below.
      const first = fieldByText(page, 'First Name');
      await expect(first).toHaveCount(1);
      await first.fill('Eee');
      const display = fieldByText(page, 'Display Name (Max 20)');
      await expect(display).toHaveCount(1);
      await display.fill(newName);
      await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
      await expect(page.getByRole('heading', { level: 2, name: newName, exact: true })).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => (await getDoc(`users/${uid}`))?.displayName).toBe(newName);
      await expect.poll(async () => (await getDoc(`public_users/${uid}`))?.displayName, { message: 'the public name follows' }).toBe(newName);
    } finally {
      await restoreDocs(snapshot);
    }
    expect(await snapshotDocs([`users/${uid}`, `public_users/${uid}`])).toEqual(snapshot);
  });
});
