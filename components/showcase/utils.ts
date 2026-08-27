import type { User } from '../../types.ts';
import type { Category } from '../ui/index.ts';

export type ProcessedUser = User;

/** The four scoring categories, in the order they are always shown. */
export const CATEGORY_KEYS: Category[] = ['gp', 'quali', 'sprint', 'fl'];

/** Short labels for the tight spaces — cards, bars, radar axes. */
export const SHORT_LABEL: Record<Category, string> = {
  gp: 'GP', quali: 'Qual', sprint: 'Sprint', fl: 'FL',
};

export const pointsOf = (u?: ProcessedUser | null): number => u?.totalPoints ?? 0;

export const categoryOf = (u: ProcessedUser | null | undefined, key: Category): number =>
  u?.breakdown?.[key] ?? 0;

/**
 * Identity check that survives the leaderboard's processed copies, which may carry a
 * different object identity — and occasionally a missing id — than the auth user.
 */
export const isSameUser = (a?: ProcessedUser | null, b?: ProcessedUser | null): boolean => {
  if (!a || !b) return false;
  if (a.id && b.id) return a.id === b.id;
  if (a.email && b.email) return a.email.toLowerCase() === b.email.toLowerCase();
  if (a.displayName && b.displayName) return a.displayName.toLowerCase() === b.displayName.toLowerCase();
  return false;
};

/**
 * Mean points per category across the whole league. This is what turns a bare breakdown
 * into a judgement: 40 fastest-lap points means nothing until you know the field averages 25.
 */
export const leagueAverages = (users: ProcessedUser[]): Record<Category, number> => {
  const n = users.length || 1;
  const sum = { gp: 0, quali: 0, sprint: 0, fl: 0 } as Record<Category, number>;
  users.forEach(u => CATEGORY_KEYS.forEach(k => { sum[k] += categoryOf(u, k); }));
  return CATEGORY_KEYS.reduce((acc, k) => {
    acc[k] = Math.round(sum[k] / n);
    return acc;
  }, {} as Record<Category, number>);
};

/** Where a user's category total sits against the field, as a signed difference. */
export const categoryDeltas = (
  user: ProcessedUser,
  averages: Record<Category, number>
): { key: Category; value: number; delta: number }[] =>
  CATEGORY_KEYS.map(key => ({
    key,
    value: categoryOf(user, key),
    delta: categoryOf(user, key) - averages[key],
  }));

/**
 * Category colors as hex, for SVG paint where a Tailwind class cannot reach.
 * Mirrors `--color-category-*` in styles/theme.css; keep the two in step.
 */
export const CATEGORY_HEX: Record<Category, string> = {
  gp: '#DA291C', quali: '#3b82f6', sprint: '#eab308', fl: '#a855f7',
};

/** The one gold in the application: P1. */
export const GOLD_HEX = '#fbbf24';
