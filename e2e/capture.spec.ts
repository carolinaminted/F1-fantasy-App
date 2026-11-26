import { test, expect } from './fixtures.ts';
import type { Page, TestInfo } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SURFACES, type Surface } from './surfaces.ts';
import { THEME_STORAGE_KEY } from './lib/app.ts';
import { stripQuery } from './lib/capture-noise.ts';
import {
  captureKey, capturePaths, NOTE_ANNOTATION, parseSides, parseSurfaceFilter, TARGET_ANNOTATION, THEMES,
  type CaptureNote, type CaptureTarget, type Side, type Theme,
} from './lib/capture-plan.ts';
import { ariaText, assertFits, DETERMINISM_INIT, settle, stableScreenshot } from './lib/capture.ts';

// The config guarantees these whenever capture projects exist.
const sides = parseSides(process.env.E2E_SIDES);
const runDir = process.env.E2E_RUN_DIR ?? '';
const frozenAt = new Date(Number(process.env.E2E_FROZEN_AT));
const filter = parseSurfaceFilter(process.env.E2E_SURFACES, SURFACES.map((s) => s.id));
const surfaces = filter ? SURFACES.filter((s) => filter.includes(s.id)) : SURFACES;

// Capture never writes: the app's own writes are aborted and reported, and their log noise is expected.
test.use({ readOnly: true, allowBlockedWriteNoise: true });

async function capture(page: Page, surface: Surface, theme: Theme, side: Side, blocked: string[], testInfo: TestInfo): Promise<void> {
  const key = captureKey(testInfo.project.name, surface.id, theme);
  const target: CaptureTarget = { key, surface: surface.id, theme, project: testInfo.project.name, side: side.name };
  testInfo.annotations.push({ type: TARGET_ANNOTATION, description: JSON.stringify(target) });

  await page.context().addInitScript(DETERMINISM_INIT);
  await page.context().addInitScript(([k, v]) => localStorage.setItem(k, v), [THEME_STORAGE_KEY, theme] as const);
  await page.clock.setFixedTime(frozenAt);
  await page.goto(surface.path);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await settle(page, surface);
  await assertFits(page);
  const { png, stable } = await stableScreenshot(page, { mask: surface.mask?.(page) ?? [] });
  const aria = await ariaText(page);

  const paths = capturePaths(runDir, side.name, key);
  mkdirSync(dirname(paths.png), { recursive: true });
  writeFileSync(paths.png, png);
  writeFileSync(paths.aria, aria);
  const note: CaptureNote = {
    ...target, ...paths, unstable: !stable, url: page.url(),
    blockedWrites: [...new Set(blocked.filter((b) => b.startsWith('WRITE ')).map(stripQuery))],
  };
  testInfo.annotations.push({ type: NOTE_ANNOTATION, description: JSON.stringify(note) });
}

// Base and head of one surface run back to back, so live staging data has seconds to drift, not minutes.
for (const surface of surfaces) {
  for (const theme of THEMES) {
    for (const side of sides) {
      test.describe(side.name, () => {
        test.use({ baseURL: side.baseURL });
        const title = `${surface.id} ${theme} [${side.name}]`;
        if (surface.role === 'member') test(title, async ({ memberPage, blocked }, testInfo) => capture(memberPage, surface, theme, side, blocked, testInfo));
        else if (surface.role === 'admin') test(title, async ({ adminPage, blocked }, testInfo) => capture(adminPage, surface, theme, side, blocked, testInfo));
        else test(title, async ({ anonPage, blocked }, testInfo) => capture(anonPage, surface, theme, side, blocked, testInfo));
      });
    }
  }
}
