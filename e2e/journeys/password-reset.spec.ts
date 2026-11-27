import { randomBytes } from 'node:crypto';
import { test, expect } from '../fixtures.ts';
import { newRunId, runEmail } from '../lib/identities.ts';
import { extractResetLink, waitForMessage } from '../lib/mail.ts';
import { createAuthUser } from '../lib/staging-admin.ts';
import { deleteRunAccount } from '../lib/teardown.ts';
import { confirmPasswordReset, oobCodeFromResetLink, passwordWorks } from '../lib/reset-link.ts';

// A password change revokes refresh tokens, so this never touches e2e-member: it resets a throwaway account.
test.describe('password reset', () => {
  test.use({ readOnly: false });
  const email = runEmail(newRunId());
  test.afterAll(async () => { await deleteRunAccount(email); });

  test('a member asks for a reset link, gets it by mail, and the new password works', { tag: '@write' }, async ({ anonPage: page, requires }) => {
    test.skip(test.info().project.name !== 'desktop', 'one write per run: desktop only');
    test.skip(process.env.E2E_REAL_MAIL !== '1', 'needs E2E_REAL_MAIL=1: the reset link only arrives by mail');
    test.setTimeout(180_000);
    await requires('maintenance-off');

    const oldPassword = `Old-${randomBytes(9).toString('base64url')}`;
    const newPassword = `New-${randomBytes(9).toString('base64url')}`;
    await createAuthUser({ email, password: oldPassword, displayName: 'E2E Reset' });

    await page.goto('/');
    await page.getByRole('button', { name: 'Forgot Password?', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Reset Password' })).toBeVisible();
    const since = new Date();
    await page.getByRole('textbox').fill(email); // the reset view's only textbox; its label has no htmlFor
    await page.getByRole('button', { name: 'Send Reset Link', exact: true }).click();
    await expect(page.getByText(/^If an account exists with this email, a password reset link has been sent\./)).toBeVisible({ timeout: 20_000 });

    const mail = await waitForMessage({ to: email, subjectIncludes: 'Reset Your Password', since, timeoutMs: 120_000 });
    const link = extractResetLink(mail.html);
    expect(link, 'the mail carries a reset link').not.toBeNull();
    await confirmPasswordReset(oobCodeFromResetLink(link!), newPassword);

    expect(await passwordWorks(email, newPassword), 'new password signs in').toBe(true);
    expect(await passwordWorks(email, oldPassword), 'old password no longer does').toBe(false);
  });
});
