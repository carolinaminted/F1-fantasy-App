import { test, expect } from '../fixtures.ts';
import { firestoreOutage } from '../lib/firestore-outage.ts';
import { appStateDocsIn, writeChannelMessages } from '../lib/write-channel.ts';

test('spike J9 step 1: what a blocked Write channel sends', async ({ memberPage, writeBodies }) => {
  await memberPage.goto('/');
  await expect.poll(() => [...writeBodies.values()].flat().length, { timeout: 30_000 }).toBeGreaterThan(0);
  // Field names only: these bodies can carry the member's token. An unknown key is not printed,
  // because a body that is not form-encoded would turn up whole as one key.
  const shapes = [...writeBodies.values()].flat().map((body) => [...new URLSearchParams(body)].map(([key, value]) => {
    if (/^(count|ofs|headers)$/.test(key)) return key;
    if (!/^req\d+___data__$/.test(key)) return '(unexpected key)';
    try { return `${key}{${Object.keys(JSON.parse(value)).join(',')}}`; } catch { return `${key}{unparsed}`; }
  }).join(' '));
  console.log([...new Set(shapes)].join('\n'));
});

test.describe('writes observed', () => {
  test.use({ observeWrites: true });

  test('spike J9: a member who starts offline queues no app_state default', async ({ memberPage, writeBodies, expectError, requires }) => {
    test.setTimeout(150_000);
    await requires('maintenance-off', 'calendar-present', 'member-is-not-admin');
    expectError(/^(console\.error|pageerror): /);
    const outage = await firestoreOutage(memberPage);
    await memberPage.goto('/');
    await memberPage.waitForTimeout(15_000);
    outage.restore();
    await expect(memberPage.getByText('E2E Member').filter({ visible: true }).first()).toBeVisible({ timeout: 60_000 });
    await memberPage.waitForTimeout(15_000);
    const bodies = [...writeBodies.values()].flat();
    const docs = appStateDocsIn(bodies);
    console.log(`[spike J9] app_state docs named by writes: ${docs.join(', ') || 'none'}; unreadable bodies: ${bodies.filter((b) => writeChannelMessages(b) === null).length}`);
    expect(docs.filter((d) => d !== 'race_results'), 'an offline start must not write app_state defaults').toEqual([]);
    // Proof that writes are observable: [PROD-11] seeds race_results while staging has no results.
    expect(docs).toContain('race_results');
  });
});
