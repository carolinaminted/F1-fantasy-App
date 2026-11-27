import { test, expect } from '../fixtures.ts';
import { ADMIN_EMAIL } from '../lib/identities.ts';
import { deleteDoc, getDoc, queryDocIds, uidOf } from '../lib/staging-admin.ts';

// Only codes the e2e-admin account created; it is a test identity and creates codes nowhere else.
const codesByE2eAdmin = async () => queryDocIds('invitation_codes', 'createdBy', await uidOf(ADMIN_EMAIL));

test.describe('invitations', () => {
  test.use({ readOnly: false });

  test('admin creates an invite code and deletes it', { tag: '@write' }, async ({ adminPage: page, requires }) => {
    test.skip(test.info().project.name !== 'desktop', 'one write per run: desktop only');
    test.setTimeout(120_000);
    await requires('maintenance-off', 'admin-is-admin');

    const before = new Set(await codesByE2eAdmin());
    let code = '';
    try {
      await page.goto('/admin?tool=invitations');
      await expect(page.getByRole('heading', { level: 1, name: 'INVITE CODES', exact: true })).toBeVisible({ timeout: 20_000 });
      await page.getByRole('button', { name: 'Create', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: /created successfully\./ })).toBeVisible();
      await expect.poll(async () => {
        const fresh = (await codesByE2eAdmin()).filter((id) => !before.has(id));
        code = fresh.length === 1 ? fresh[0] : '';
        return fresh.length;
      }, { message: 'exactly one new code' }).toBe(1);
      expect((await getDoc(`invitation_codes/${code}`))?.status).toBe('active');

      await page.getByRole('row').filter({ hasText: code }).click();
      await page.getByRole('dialog').filter({ hasText: 'Invitation code' }).getByRole('button', { name: 'Delete this code', exact: true }).click();
      await page.getByRole('dialog').filter({ hasText: 'is removed for good' }).getByRole('button', { name: 'Delete code', exact: true }).click();
      await expect(page.getByRole('alert').filter({ hasText: `Code ${code} deleted permanently.` })).toBeVisible();
      await expect.poll(async () => getDoc(`invitation_codes/${code}`), { message: 'the code is gone' }).toBeNull();
      // Known app bug: the delete confirm stays open afterwards (AdminInvitationPage executeDelete). Not asserted.
    } finally {
      for (const id of await codesByE2eAdmin()) if (!before.has(id)) await deleteDoc(`invitation_codes/${id}`);
    }
  });
});
