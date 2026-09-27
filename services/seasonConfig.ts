/**
 * Which events score, from `season_config/current`.
 *
 * Branded so it cannot be passed where `cancelledEventIds` (also a set of event ids) is expected.
 * The engine functions take both side by side, and swapping them would compile and score wrong.
 */
export type ScoredEventIds = ReadonlySet<string> & { readonly __brand: 'ScoredEventIds' };

export const toScoredEventIds = (ids: readonly string[]): ScoredEventIds =>
  new Set(ids) as unknown as ScoredEventIds;

export const NO_SCORED_EVENTS = toScoredEventIds([]);

export const parseSeasonConfig = (data: unknown): ScoredEventIds | null => {
  const ids = (data as { scoredEventIds?: unknown } | undefined)?.scoredEventIds;
  const valid = Array.isArray(ids)
    && ids.length > 0
    && ids.every((id) => typeof id === 'string' && id.length > 0);
  return valid ? toScoredEventIds(ids as string[]) : null;
};
