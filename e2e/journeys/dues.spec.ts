import { test, expect } from '../fixtures.ts';
import { MEMBER_EMAIL } from '../lib/identities.ts';
import { getDoc, uidOf } from '../lib/staging-admin.ts';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('unpaid member sees what they owe and the payment memo, from League and from Profile', async ({ memberPage: page, requires }) => {
  test.setTimeout(60_000);
  await requires('maintenance-off', 'calendar-present', 'member-dues-unpaid');

  await page.goto('/league');
  await page.getByRole('button', { name: /^Dues Due/ }).click();
  const sheet = page.getByRole('dialog').filter({ hasText: 'Pay League Dues' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(/^Entry fee for the .+ season\.$/)).toBeVisible();
  await expect(sheet.getByRole('textbox')).toHaveValue(new RegExp(`^Dues Payment • \\d{4}-\\d{2}-\\d{2} • ${escape(MEMBER_EMAIL)}`));
  await expect(sheet.getByRole('button', { name: 'Pay with Venmo' })).toBeVisible(); // seen, never clicked
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(page).not.toHaveURL(/dues=1/);

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Dues: Unpaid', exact: true }).click();
  await expect(page).toHaveURL(/\/league\?dues=1/);
  await expect(page.getByRole('dialog').filter({ hasText: 'Pay League Dues' })).toBeVisible();
});

test.describe('admin dues toggle', () => {
  test.use({ readOnly: false });

  test('admin marks e2e-member paid, the member sees it, and the admin sets it back', { tag: '@write' }, async ({ adminPage, memberPage, requires, restoring }) => {
    test.skip(test.info().project.name !== 'desktop', 'one write per run: desktop only');
    test.setTimeout(150_000);
    await requires('maintenance-off', 'calendar-present', 'member-dues-unpaid', 'admin-is-admin');

    const uid = await uidOf(MEMBER_EMAIL);
    await restoring([`users/${uid}`]);
    const name = String((await getDoc(`users/${uid}`))!.displayName);
    await adminPage.goto('/admin?tool=manage-users');
    await adminPage.getByPlaceholder(/Search by name or email/).fill(MEMBER_EMAIL);
    await adminPage.getByRole('row').filter({ hasText: name }).click();
    await expect(adminPage.getByRole('heading', { level: 1, name: name.toUpperCase(), exact: true })).toBeVisible({ timeout: 20_000 });

    const paid = adminPage.getByRole('switch', { name: 'Dues paid' });
    // The dues "Save" sits beside the switch; another "Save" on the page belongs to the admin flag.
    const save = adminPage.locator('div').filter({ has: paid }).filter({ has: adminPage.getByRole('button', { name: 'Save', exact: true }) }).last()
      .getByRole('button', { name: 'Save', exact: true });

    await expect(paid).toHaveAttribute('aria-checked', 'false');
    await paid.click();
    await save.click();
    await expect(adminPage.getByRole('alert').filter({ hasText: `Successfully updated dues status to Paid for ${name}.` })).toBeVisible();
    await expect.poll(async () => (await getDoc(`users/${uid}`))?.duesPaidStatus).toBe('Paid');

    await memberPage.goto('/league');
    await expect(memberPage.getByText('Dues Paid', { exact: true })).toBeVisible({ timeout: 20_000 });

    await paid.click();
    await expect(paid).toHaveAttribute('aria-checked', 'false');
    await save.click();
    await expect(adminPage.getByRole('alert').filter({ hasText: `Successfully updated dues status to Unpaid for ${name}.` })).toBeVisible();
    await expect.poll(async () => (await getDoc(`users/${uid}`))?.duesPaidStatus, { message: 'the admin can set it back' }).toBe('Unpaid');
  });
});
