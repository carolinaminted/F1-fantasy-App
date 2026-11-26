import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { diffAria, diffPng } from './diff.ts';

const solid = (width: number, height: number, rgba: number[], tweak?: (p: PNG) => void): Buffer => {
  const p = new PNG({ width, height });
  for (let i = 0; i < p.data.length; i += 4) p.data.set(rgba, i);
  tweak?.(p);
  return PNG.sync.write(p);
};
const WHITE = [255, 255, 255, 255];

test('identical images have no diff', () => {
  const d = diffPng(solid(10, 10, WHITE), solid(10, 10, WHITE));
  assert.deepEqual({ diffPixels: d.diffPixels, diffRatio: d.diffRatio, sizeChanged: d.sizeChanged }, { diffPixels: 0, diffRatio: 0, sizeChanged: false });
});

test('one changed pixel is counted', () => {
  const d = diffPng(solid(10, 10, WHITE), solid(10, 10, WHITE, (p) => p.data.set([0, 0, 0, 255], 0)));
  assert.equal(d.diffPixels, 1);
  assert.equal(d.diffRatio, 0.01);
});

test('a taller image counts its extra rows as changed', () => {
  const d = diffPng(solid(10, 10, WHITE), solid(10, 12, WHITE));
  assert.equal(d.sizeChanged, true);
  assert.equal(d.height, 12);
  assert.equal(d.diffPixels, 20);
  assert.ok(PNG.sync.read(d.diffPng).height === 12);
});

test('diffAria returns a patch only when the text differs', () => {
  assert.deepEqual(diffAria('- heading "A"\n', '- heading "A"\n'), { changed: false, patch: '' });
  const d = diffAria('- heading "A"\n', '- heading "B"\n', 'home.aria.yml');
  assert.equal(d.changed, true);
  assert.match(d.patch, /^-- heading "A"$/m);
  assert.match(d.patch, /^\+- heading "B"$/m);
  assert.match(d.patch, /base\/home\.aria\.yml/);
});
