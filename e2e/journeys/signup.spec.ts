import { test, expect } from '../fixtures.ts';
import { stagingBadge } from '../lib/app.ts';
import { newRunId, runEmail } from '../lib/identities.ts';
import { mintInvite, readSignupCode } from '../lib/codes.ts';
import { waitForMessage, extractSixDigitCode } from '../lib/mail.ts';
import { deleteRunAccount } from '../lib/teardown.ts';
import { getDoc, lookupUserByEmail } from '../lib/staging-admin.ts';

const realMail = process.env.E2E_REAL_MAIL === '1';

test.describe('sign-up', () => {
  const runId = newRunId();
  const email = runEmail(runId);
  test.afterAll(async () => { await deleteRunAccount(email); });

  test(`new member signs up with an invite and a ${realMail ? 'delivered' : 'Firestore'} code`, { tag: '@write' }, async ({ anonPage: page }) => {
    test.skip(test.info().project.name !== 'desktop', 'writes to staging and spends rate limit; desktop only');
    test.setTimeout(realMail ? 180_000 : 120_000); // four callables plus a Firestore poll, or an IMAP wait, exceed the 30 s default
    const invite = await mintInvite(runId);

    await page.goto('/');
    await expect(stagingBadge(page)).toBeVisible();
    await page.getByRole('button', { name: "Don't have an account? Sign Up" }).click();
    await page.getByPlaceholder('LOL-XXXX-XXXX').fill(invite);
    await page.getByRole('button', { name: 'Validate Code' }).click();

    await page.locator('#signup-email').fill(email);
    const startedAt = Date.now();
    await page.getByRole('button', { name: 'Send Verification Code' }).click();
    await expect(page.locator('#code')).toBeVisible({ timeout: 30_000 });

    const code = realMail
      ? extractSixDigitCode((await waitForMessage({ to: email, subjectIncludes: 'Your Verification Code', since: new Date(startedAt - 60_000) })).text)
      : await readSignupCode(email, startedAt);
    expect(code, 'verification code').toMatch(/^\d{6}$/);
    await page.locator('#code').fill(code!);
    await page.getByRole('button', { name: 'Verify Code' }).click();

    // validateRealName allows letters only, so the run id (which carries digits) goes in the display name.
    await page.getByPlaceholder('John').fill('Eetoe');
    await page.getByPlaceholder('Doe').fill('Runner');
    await page.getByPlaceholder('Team Name').fill(`E2E ${runId}`);
    const passwords = page.getByPlaceholder('••••••••');
    await passwords.nth(0).fill(`E2e-${runId}-pw!`);
    await passwords.nth(1).fill(`E2e-${runId}-pw!`);
    await page.getByRole('button', { name: 'Complete Registration' }).click();

    // The button relabels to "Creating Account…" while busy, so wait for the whole form to go instead.
    await expect(page.getByPlaceholder('John')).toBeHidden({ timeout: 45_000 });
    await expect(page.locator('#login-email')).toBeHidden();
    await expect(stagingBadge(page)).toBeVisible();

    // The profile transaction commits after the form closes, so poll rather than read once.
    const uid = await expect.poll(async () => (await lookupUserByEmail(email))?.localId ?? null, { message: 'auth user created', timeout: 15_000 }).not.toBeNull().then(async () => (await lookupUserByEmail(email))!.localId);
    await expect.poll(async () => (await getDoc(`users/${uid}`))?.duesPaidStatus, { timeout: 15_000 }).toBe('Unpaid');
    await expect.poll(async () => (await getDoc(`invitation_codes/${invite}`))?.status, { timeout: 15_000 }).toBe('used');
  });
});
