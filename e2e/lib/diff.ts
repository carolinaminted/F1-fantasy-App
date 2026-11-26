import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { createTwoFilesPatch } from 'diff';

export type PngDiff = { diffPixels: number; diffRatio: number; sizeChanged: boolean; width: number; height: number; diffPng: Buffer };

// Padding is magenta so a page that grew or shrank shows its extra area as changed.
const PAD = [255, 0, 255, 255];

function padTo(img: PNG, width: number, height: number): PNG {
  if (img.width === width && img.height === height) return img;
  const out = new PNG({ width, height });
  for (let i = 0; i < out.data.length; i += 4) out.data.set(PAD, i);
  PNG.bitblt(img, out, 0, 0, img.width, img.height, 0, 0);
  return out;
}

export function diffPng(a: Buffer, b: Buffer): PngDiff {
  const ia = PNG.sync.read(a);
  const ib = PNG.sync.read(b);
  const width = Math.max(ia.width, ib.width);
  const height = Math.max(ia.height, ib.height);
  const pa = padTo(ia, width, height);
  const pb = padTo(ib, width, height);
  const out = new PNG({ width, height });
  const diffPixels = pixelmatch(pa.data, pb.data, out.data, width, height, { threshold: 0.1 });
  return {
    diffPixels,
    diffRatio: diffPixels / (width * height),
    sizeChanged: ia.width !== ib.width || ia.height !== ib.height,
    width,
    height,
    diffPng: PNG.sync.write(out),
  };
}

export function diffAria(a: string, b: string, label = 'aria.yml'): { changed: boolean; patch: string } {
  if (a === b) return { changed: false, patch: '' };
  return { changed: true, patch: createTwoFilesPatch(`base/${label}`, `head/${label}`, a, b, '', '', { context: 2 }) };
}
