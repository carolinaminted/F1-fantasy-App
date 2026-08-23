import { User } from '../types.ts';
import type { Category } from '../components/ui/tokens.ts';

export const categoryScore = (user: User | undefined, key: Category): number =>
    user?.breakdown?.[key] ?? 0;

export interface CategoryStanding {
    rank: number;
    /** How many members were ranked, for the "#2 of 14" reading. */
    total: number;
    score: number;
}

/**
 * Where one member sits in a single scoring category.
 *
 * Standard competition ranking: equal scores share the better rank, and the next distinct
 * score skips accordingly (1, 2, 2, 4). Two people on the same points must never be told
 * one of them is ahead purely because of array order.
 *
 * Returns null when the league's per-category totals are not loaded — the caller shows
 * points alone rather than inventing a rank.
 */
export const rankInCategory = (
    users: User[],
    userId: string | undefined,
    key: Category
): CategoryStanding | null => {
    if (!userId) return null;

    const ranked = users.filter(u => typeof u.breakdown?.[key] === 'number');
    const me = ranked.find(u => u.id === userId);
    if (!me) return null;

    const score = categoryScore(me, key);
    const ahead = ranked.filter(u => categoryScore(u, key) > score).length;

    return { rank: ahead + 1, total: ranked.length, score };
};
