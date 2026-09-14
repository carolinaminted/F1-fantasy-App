import { CONSTRUCTORS } from '../../constants.ts';
import type { Constructor } from '../../types.ts';

/**
 * The four scoring categories already carry fixed colors across the app —
 * `getVariantTheme` in LeaderboardPage, the Scoring Rules cards, the Insights
 * superlatives, and the admin Scoring Settings page all agree on this mapping.
 * Naming it here is what makes it a system rather than a coincidence.
 *
 * These now go through the `--color-category-*` tokens rather than naming Tailwind steps
 * directly. Dark is unchanged — the tokens resolve to exactly blue-500 / yellow-500 /
 * purple-500 — but light mode needs blue and yellow a step darker to carry text on a
 * near-white canvas, and only a token can be overridden per theme. The hue mapping that
 * DESIGN.md protects (GP red, Quali blue, Sprint yellow, FL purple) is unchanged.
 */
export type Category = 'gp' | 'quali' | 'sprint' | 'fl';

export const CATEGORY_THEME: Record<Category, {
  label: string; text: string; border: string; bg: string; ring: string; from: string;
  /**
   * The accent as a CSS value rather than a class. A border-color *class* ties with the one
   * TILE_BASE already sets, so whichever Tailwind happens to emit later wins — which silently
   * left the red and blue accents gray. Anything painting a border uses this instead.
   */
  css: string;
}> = {
  gp:     { label: 'Grand Prix',  text: 'text-category-gp',     border: 'border-category-gp',     bg: 'bg-category-gp',     ring: 'ring-category-gp',     from: 'from-category-gp/20',     css: 'var(--color-category-gp)' },
  quali:  { label: 'Qualifying',  text: 'text-category-quali',  border: 'border-category-quali',  bg: 'bg-category-quali',  ring: 'ring-category-quali',  from: 'from-category-quali/20',  css: 'var(--color-category-quali)' },
  sprint: { label: 'Sprint',      text: 'text-category-sprint', border: 'border-category-sprint', bg: 'bg-category-sprint', ring: 'ring-category-sprint', from: 'from-category-sprint/20', css: 'var(--color-category-sprint)' },
  fl:     { label: 'Fastest Lap', text: 'text-category-fl',     border: 'border-category-fl',     bg: 'bg-category-fl',     ring: 'ring-category-fl',     from: 'from-category-fl/20',     css: 'var(--color-category-fl)' },
};

/**
 * Semantic tones. Green = paid/success, amber = warning, red = error/locked.
 *
 * The text colors are tokens so they can drop a step on light — green-400 and amber-400
 * were chosen against a near-black canvas and do not carry on near-white. Dark resolves
 * to exactly the steps they always were. The /40 borders and /10 fills stay as Tailwind
 * steps: at those opacities they are tints, and they read on either canvas.
 */
export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const TONE_THEME: Record<Tone, { text: string; border: string; bg: string }> = {
  neutral: { text: 'text-highlight-silver', border: 'border-pure-white/10',  bg: 'bg-pure-white/5' },
  success: { text: 'text-tone-success',     border: 'border-green-500/40',   bg: 'bg-green-500/10' },
  warning: { text: 'text-tone-warning',     border: 'border-amber-500/40',   bg: 'bg-amber-500/10' },
  danger:  { text: 'text-primary-red',      border: 'border-primary-red/40', bg: 'bg-primary-red/10' },
  info:    { text: 'text-tone-info',        border: 'border-indigo-500/40',  bg: 'bg-indigo-500/10' },
};

/** One tile spec, so page-local variants stop drifting apart. */
export const TILE_BASE =
  'rounded-xl border border-pure-white/10 bg-accent-gray/40 backdrop-blur-sm transition-all duration-200';
export const TILE_INTERACTIVE =
  'cursor-pointer hover:border-pure-white/25 hover:bg-accent-gray/60 active:scale-[0.99]';

/** Tabular numerals for anything that is a number the reader compares vertically. */
export const NUMERIC = 'font-mono tabular-nums';

/** Resolve a constructor's brand color, falling back to the static grid if the DB row is stale. */
export const teamColor = (
  constructorId: string | undefined,
  allConstructors: Constructor[] = []
): string | undefined => {
  if (!constructorId) return undefined;
  return allConstructors.find(c => c.id === constructorId)?.color
      ?? CONSTRUCTORS.find(c => c.id === constructorId)?.color;
};

/** Hex -> rgba, for tinted backgrounds built from a team color. */
export const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
