import { test, expect } from '../fixtures.ts';

test('console and page errors on the built-in page are recorded', async ({ page, expectError }) => {
  expectError(/^console\.error: e2e-injected-console$/);
  expectError(/^pageerror: e2e-injected-throw$/);
  await page.setContent('<p>probe</p>');
  await page.evaluate(() => { console.error('e2e-injected-console'); setTimeout(() => { throw new Error('e2e-injected-throw'); }, 0); });
  await page.waitForTimeout(200);
});

test.fail('an undeclared console.error on the built-in page fails the test', async ({ page }) => {
  await page.setContent('<script>console.error("e2e-injected-console")</script>');
  await page.waitForTimeout(200);
  await expect(page.locator('body')).toBeAttached();
});
