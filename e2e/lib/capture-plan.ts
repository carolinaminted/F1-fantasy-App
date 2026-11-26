import { join } from 'node:path';
import { GuardError } from './guards.ts';

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];
export type Side = { name: string; baseURL: string };
export type CaptureTarget = { key: string; surface: string; theme: Theme; project: string; side: string };
export type CaptureNote = CaptureTarget & { png: string; aria: string; unstable: boolean; blockedWrites: string[]; url: string };

// Pushed at the start of every capture test (so a failure can be placed) and on success.
export const TARGET_ANNOTATION = 'capture-target';
export const NOTE_ANNOTATION = 'capture';

const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function parseSides(raw: string | undefined): Side[] {
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new GuardError('E2E_SIDES is not JSON'); }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 2) throw new GuardError('E2E_SIDES must list one or two sides');
  const sides = parsed.map((s: Record<string, unknown>) => {
    if (!s || typeof s.name !== 'string' || typeof s.baseURL !== 'string' || !NAME.test(s.name)) throw new GuardError(`bad side in E2E_SIDES: ${JSON.stringify(s)}`);
    return { name: s.name, baseURL: s.baseURL };
  });
  if (new Set(sides.map((s) => s.name)).size !== sides.length) throw new GuardError('E2E_SIDES names must be unique');
  return sides;
}

export function parseSurfaceFilter(raw: string | undefined, known: string[]): string[] | null {
  const ids = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return null;
  const unknown = ids.filter((id) => !known.includes(id));
  if (unknown.length) throw new Error(`unknown surface(s): ${unknown.join(', ')}; known: ${known.join(', ')}`);
  return ids;
}

export const captureKey = (project: string, surface: string, theme: Theme): string => `${project}/${surface}--${theme}`;

export const capturePaths = (runDir: string, side: string, key: string): { png: string; aria: string } => ({
  png: join(runDir, side, `${key}.png`),
  aria: join(runDir, side, `${key}.aria.yml`),
});
