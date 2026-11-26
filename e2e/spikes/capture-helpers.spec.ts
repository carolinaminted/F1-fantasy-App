import { test, expect } from '../fixtures.ts';
import { assertFits, DETERMINISM_INIT, LOADING_PLACEHOLDER, stableScreenshot } from '../lib/capture.ts';

test('assertFits names the element that overflows', async ({ anonPage }) => {
  await anonPage.setContent('<body style="margin:0"><div id="ok">fine</div><div id="e2e-wide" style="width:3000px">wide</div></body>');
  await expect(assertFits(anonPage)).rejects.toThrow(/div#e2e-wide "wide" right=3000/);
});

test('assertFits passes a page that fits', async ({ anonPage }) => {
  await anonPage.setContent('<body style="margin:0"><div style="width:100px">narrow</div></body>');
  await assertFits(anonPage);
});

test('stableScreenshot reports a still page as stable', async ({ anonPage }) => {
  await anonPage.setContent('<p>still</p>');
  expect((await stableScreenshot(anonPage, { mask: [] })).stable).toBe(true);
});

test('stableScreenshot reports a ticking page as unstable', async ({ anonPage }) => {
  await anonPage.setContent('<p id="t">0</p><script>let n=0;setInterval(()=>{document.getElementById("t").textContent=String(n++)},50)</script>');
  expect((await stableScreenshot(anonPage, { mask: [], attempts: 3, intervalMs: 120 })).stable).toBe(false);
});

test('DETERMINISM_INIT gives every page the same Math.random sequence', async ({ anonPage, browser }) => {
  const other = await browser.newPage();
  try {
    const seq = (p: typeof anonPage) => p.evaluate((script) => { (0, eval)(script); return [Math.random(), Math.random(), Math.random()]; }, DETERMINISM_INIT);
    const a = await seq(anonPage);
    expect(await seq(other)).toEqual(a);
    for (const v of a) expect(v >= 0 && v < 1).toBe(true);
  } finally {
    await other.close();
  }
});

test('LOADING_PLACEHOLDER ignores a persistent animate-pulse dot', async ({ anonPage }) => {
  await anonPage.setContent('<span class="animate-pulse bg-red-400" style="display:inline-block;width:8px;height:8px"></span>');
  await expect(anonPage.locator(LOADING_PLACEHOLDER).filter({ visible: true })).toHaveCount(0);
});

test('LOADING_PLACEHOLDER matches a Skeleton block', async ({ anonPage }) => {
  await anonPage.setContent('<div class="animate-pulse bg-pure-white/5" style="width:50px;height:10px"></div>');
  await expect(anonPage.locator(LOADING_PLACEHOLDER).filter({ visible: true })).toHaveCount(1);
});

test('LOADING_PLACEHOLDER matches a Dashboard placeholder container', async ({ anonPage }) => {
  await anonPage.setContent('<div class="animate-pulse"><div class="bg-pure-white/10" style="width:50px;height:10px"></div></div>');
  await expect(anonPage.locator(LOADING_PLACEHOLDER).filter({ visible: true })).toHaveCount(1);
});
