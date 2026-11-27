import type { Locator, Page } from '@playwright/test';

// For forms whose <label>s lack htmlFor: the textbox inside the innermost element that holds the label text.
// Ancestors come first in document order, so the last match is the innermost.
export const fieldByText = (page: Page, label: string): Locator =>
  page.locator('div').filter({ has: page.getByText(label, { exact: true }) }).last().getByRole('textbox');
