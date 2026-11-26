import { expect, type Locator, type Page } from '@playwright/test';
import { stagingBadge } from './app.ts';
import type { Surface } from '../surfaces.ts';

// The clock is frozen but Math.random is not: the easter egg, the sign-in transition variant and
// the red-flag screen use it. A seeded generator (mulberry32) makes two runs of the same code match.
export const DETERMINISM_INIT = `(() => {
  let s = 0x2f6b1d3;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;

export async function settle(page: Page, surface: Pick<Surface, 'role' | 'ready'>): Promise<void> {
  await expect(stagingBadge(page), 'the STAGING badge must render on every surface').toBeVisible({ timeout: 20_000 });
  if (surface.role === 'anon') await expect(page.locator('#login-email')).toBeVisible({ timeout: 20_000 });
  else await expect(page.locator('#login-email')).toBeHidden({ timeout: 30_000 });
  if (surface.ready) await expect(surface.ready(page)).toBeVisible({ timeout: 20_000 });
  // LoadingSkeleton renders .animate-pulse blocks while Firestore data is on its way.
  await expect(page.locator('.animate-pulse').filter({ visible: true }), 'loading skeletons still visible').toHaveCount(0, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

// Fails only when the document itself scrolls sideways, naming the outermost offending elements.
export async function assertFits(page: Page): Promise<void> {
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    if (de.scrollWidth <= de.clientWidth + 1) return null;
    const describe = (el: Element) => {
      const id = el.id ? `#${el.id}` : '';
      const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
      return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
    };
    const overflows = (el: Element | null) => !!el && el.getBoundingClientRect().right > de.clientWidth + 1 && el.getBoundingClientRect().width > 0;
    const offenders: string[] = [];
    for (const el of document.querySelectorAll('body *')) {
      if (overflows(el) && !overflows(el.parentElement === document.body ? null : el.parentElement)) {
        offenders.push(`${describe(el)} right=${Math.round(el.getBoundingClientRect().right)}`);
        if (offenders.length >= 5) break;
      }
    }
    return { by: de.scrollWidth - de.clientWidth, offenders };
  });
  if (r) throw new Error(`page overflows horizontally by ${r.by}px: ${r.offenders.join('; ') || 'no element found'}`);
}

// Two identical consecutive shots mean the page has stopped changing.
export async function stableScreenshot(
  page: Page,
  opts: { mask: Locator[]; attempts?: number; intervalMs?: number },
): Promise<{ png: Buffer; stable: boolean }> {
  const shot = () => page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide', mask: opts.mask, maskColor: '#FF00FF', scale: 'css' });
  const attempts = opts.attempts ?? 8;
  let prev = await shot();
  for (let i = 1; i < attempts; i++) {
    await page.waitForTimeout(opts.intervalMs ?? 400);
    const next = await shot();
    if (next.equals(prev)) return { png: next, stable: true };
    prev = next;
  }
  return { png: prev, stable: false };
}

export const ariaText = (page: Page): Promise<string> => page.locator('body').ariaSnapshot();
