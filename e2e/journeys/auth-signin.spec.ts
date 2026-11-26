import { test, expect } from '../fixtures.ts';
import { adminEntry, stagingBadge } from '../lib/app.ts';
import { NO_ACCOUNT_EMAIL } from '../lib/identities.ts';

test('member lands signed in, with no Admin entry', async ({ memberPage }) => {
  await memberPage.goto('/');
  await expect(stagingBadge(memberPage)).toBeVisible();
  await expect(memberPage.locator('#login-email')).toBeHidden();
  await expect(memberPage.getByText('Standings', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  await expect(adminEntry(memberPage)).toHaveCount(0);
});

test('admin lands signed in, with the Admin entry', async ({ adminPage }) => {
  await adminPage.goto('/');
  await expect(stagingBadge(adminPage)).toBeVisible();
  await expect(adminEntry(adminPage)).toBeVisible();
});

test('wrong password shows the error and stays on sign-in', async ({ anonPage, expectError }) => {
  const status400: string[] = [];
  anonPage.on('response', (r) => { if (r.status() === 400) status400.push(`${r.request().method()} ${r.url()}`); });
  await anonPage.goto('/');
  await expect(stagingBadge(anonPage)).toBeVisible();
  await anonPage.locator('#login-email').fill(NO_ACCOUNT_EMAIL);
  await anonPage.locator('#login-password').fill('definitely-wrong-password');
  await anonPage.getByRole('button', { name: 'Log In', exact: true }).click();
  await expect(anonPage.getByText('Invalid email or password. Please try again.')).toBeVisible();
  await expect(anonPage.locator('#login-email')).toBeVisible();
  // The allowance below is only safe if the one 400 is the sign-in request itself.
  expect(status400).toHaveLength(1);
  expect(status400[0]).toMatch(/^POST https:\/\/identitytoolkit\.googleapis\.com\/.*accounts:signInWithPassword(\?|$)/);
  // Chromium logs the 400 from signInWithPassword as a resource-load error; the URL is not in the text.
  expectError(/^console\.error: Failed to load resource: the server responded with a status of 400 \(\)$/);
});
