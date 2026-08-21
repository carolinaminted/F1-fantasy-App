import { CONSTRUCTORS } from '../../constants.ts';
import type { Constructor } from '../../types.ts';

/**
 * The four scoring categories already carry fixed colors across the app —
 * `getVariantTheme` in LeaderboardPage, the Scoring Rules cards, the Insights
 * superlatives, and the admin Scoring Settings page all agree on this mapping.
 * Naming it here is what makes it a system rather than a coincidence.
 */
export type Category = 'gp' | 'quali' | 'sprint' | 'fl';

export const CATEGORY_THEME: Record<Category, {
  label: string; text: string; border: string; bg: string; ring: string; from: string;
}> = {
  gp:     { label: 'Grand Prix',  text: 'text-primary-red',  border: 'border-primary-red',  bg: 'bg-primary-red',  ring: 'ring-primary-red',  from: 'from-primary-red/20' },
  quali:  { label: 'Qualifying',  text: 'text-blue-500',     border: 'border-blue-500',     bg: 'bg-blue-500',     ring: 'ring-blue-500',     from: 'from-blue-500/20' },
  sprint: { label: 'Sprint',      text: 'text-yellow-500',   border: 'border-yellow-500',   bg: 'bg-yellow-500',   ring: 'ring-yellow-500',   from: 'from-yellow-500/20' },
  fl:     { label: 'Fastest Lap', text: 'text-purple-500',   border: 'border-purple-500',   bg: 'bg-purple-500',   ring: 'ring-purple-500',   from: 'from-purple-500/20' },
};

/** Semantic tones. Green = paid/success, amber = warning, red = error/locked. */
export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const TONE_THEME: Record<Tone, { text: string; border: string; bg: string }> = {
  neutral: { text: 'text-highlight-silver', border: 'border-pure-white/10',  bg: 'bg-pure-white/5' },
  success: { text: 'text-green-400',        border: 'border-green-500/40',   bg: 'bg-green-500/10' },
  warning: { text: 'text-amber-400',        border: 'border-amber-500/40',   bg: 'bg-amber-500/10' },
  danger:  { text: 'text-primary-red',      border: 'border-primary-red/40', bg: 'bg-primary-red/10' },
  info:    { text: 'text-indigo-300',       border: 'border-indigo-500/40',  bg: 'bg-indigo-500/10' },
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
