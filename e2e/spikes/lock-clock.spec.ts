import { test, expect } from '../fixtures.ts';
import { SESSION_PIN_KEY, SESSION_STORAGE_KEY } from '../lib/app.ts';
import { getDoc } from '../lib/staging-admin.ts';

const HALF_DAY = 12 * 60 * 60 * 1000;

type Schedule = { name?: string; hasSprint?: boolean; customLockAt?: string; sprintQualifying?: string; qualifying?: string };

// The first race of the staging season and its lock time, chosen the way App.tsx chooses it.
// Schedule times are league-local (New York). Reading one as UTC puts it 4 or 5 hours early,
// which the 12 hour margin on each side of the lock absorbs.
async function firstLock(): Promise<{ name: string; at: number }> {
  const calendar = await getDoc('app_state/season_calendar');
  const schedules = await getDoc('app_state/event_schedules');
  const events = (calendar?.events ?? []) as { id: string; name: string; round: number; hasSprint: boolean }[];
  const first = [...events].sort((a, b) => a.round - b.round)[0];
  const sched = (schedules?.[first?.id ?? ''] ?? {}) as Schedule;
  const hasSprint = sched.hasSprint ?? first?.hasSprint;
  const local = sched.customLockAt || (hasSprint ? sched.sprintQualifying || sched.qualifying : sched.qualifying);
  expect(local, 'the first race has a lock time in app_state/event_schedules').toBeTruthy();
  return { name: sched.name || first.name, at: Date.parse(local!.endsWith('Z') ? local! : `${local}Z`) };
}

test('spike A5: a clock months ahead keeps sign-in and listeners, and crossing a lock locks the form', async ({ memberPage, requires }) => {
  test.setTimeout(150_000);
  await requires('maintenance-off', 'calendar-present', 'season-active', 'member-is-not-admin');
  const lock = await firstLock();
  const before = lock.at - HALF_DAY;
  const after = lock.at + HALF_DAY;
  expect(before, 'the first lock is still in the future').toBeGreaterThan(Date.now());

  const refreshes: number[] = [];
  memberPage.on('response', (r) => { if (r.url().startsWith('https://securetoken.googleapis.com/')) refreshes.push(r.status()); });

  await memberPage.goto('/');
  await expect(memberPage.locator('#login-email')).toBeHidden({ timeout: 30_000 });
  // Both keys: the page already open checks the session stamp as soon as its clock jumps.
  await memberPage.evaluate(({ keys, at }) => keys.forEach((key) => localStorage.setItem(key, at)),
    { keys: [SESSION_PIN_KEY, SESSION_STORAGE_KEY], at: String(after) });
  await memberPage.clock.setFixedTime(before);
  await memberPage.goto('/race?view=picks');

  await expect(memberPage.getByRole('heading', { name: lock.name, exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(memberPage.getByText('Picks Open', { exact: true })).toBeVisible();
  await memberPage.waitForTimeout(20_000);
  await expect(memberPage.locator('#login-email')).toBeHidden();

  await memberPage.clock.setFixedTime(after);
  await expect(memberPage.getByRole('heading', { name: 'Picks Are Locked', exact: true })).toBeVisible({ timeout: 10_000 });
  // Shown only while editing, which needs a member with no saved picks for this race.
  await expect.soft(memberPage.getByText("Time's up! Picks for this event are now locked.")).toBeVisible();

  await memberPage.reload();
  await expect(memberPage.locator('#login-email')).toBeHidden({ timeout: 30_000 });
  // After the first lock the page selects the next race, which is still open.
  await expect(memberPage.getByText('Picks Open', { exact: true })).toBeVisible({ timeout: 30_000 });
  console.log(`[spike A5] before=${new Date(before).toISOString()} after=${new Date(after).toISOString()} token refresh responses: ${refreshes.join(',') || 'none'}`);
});
