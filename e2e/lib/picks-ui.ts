import { expect, type Page } from '@playwright/test';

// Empty pick slots are buttons named only by their kind; Fastest Lap's placeholder is "Select Driver".
export const emptySlots = (page: Page) => page.getByRole('button', { name: /^(Team|Driver|Select Driver)$/ });

// Fills every empty slot with the first selectable option, skipping any option whose text names one in `avoid`.
export async function fillEmptySlots(page: Page, avoid: string[] = []): Promise<void> {
  for (let i = 0; i < 9 && (await emptySlots(page).count()) > 0; i++) {
    await emptySlots(page).first().click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    // Options carry text; the sheet's Close button is icon-only. Disabled options read "Already picked" or "Limit reached".
    let options = sheet.getByRole('button', { disabled: false }).filter({ hasText: /\w/ });
    for (const name of avoid) options = options.filter({ hasNotText: name });
    await options.first().click();
    await expect(sheet).toBeHidden();
  }
  await expect(emptySlots(page)).toHaveCount(0);
}

// Opens the review, confirms inside it (the form's own button stays behind the modal), and returns the event name.
export async function lockIn(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Lock In Picks', exact: true }).click();
  const review = page.getByRole('dialog').filter({ hasText: 'Review Lineup' });
  await expect(review).toBeVisible();
  await review.getByRole('button', { name: 'Lock In Picks', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Picks Locked In' })).toBeVisible({ timeout: 30_000 });
  const line = await page.getByText(/Your picks for the .+ are locked in\./).first().textContent();
  const name = /Your picks for the (.+?) are locked in\./.exec(line ?? '')?.[1];
  if (!name) throw new Error(`could not read the event name from: ${line}`);
  return name;
}
