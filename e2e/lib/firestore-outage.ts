import type { Page } from '@playwright/test';

export type Outage = { restore: () => void; aborted: () => number };

// Fails every Firestore request from this page until restore(). Afterwards it falls back, never
// continues, so the context's request guard still sees everything.
export async function firestoreOutage(page: Page): Promise<Outage> {
  let down = true;
  let aborted = 0;
  await page.route('https://firestore.googleapis.com/**', (route) => {
    if (!down) return route.fallback();
    aborted++;
    return route.abort('internetdisconnected');
  });
  return { restore: () => { down = false; }, aborted: () => aborted };
}
