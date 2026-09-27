import type { Event } from '../types.ts';

/**
 * Which events score, from `season_config/current`.
 *
 * Branded so it cannot be passed where `cancelledEventIds` (also a set of event ids) is expected.
 * The engine functions take both side by side, and swapping them would compile and score wrong.
 */
export type ScoredEventIds = ReadonlySet<string> & { readonly __brand: 'ScoredEventIds' };

export const toScoredEventIds = (ids: readonly string[]): ScoredEventIds =>
  new Set(ids) as unknown as ScoredEventIds;

export interface SeasonConfig {
  scoredEventIds: ScoredEventIds;
  seasonId: string;
  label: string;
}

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export const parseSeasonConfig = (data: unknown): SeasonConfig | null => {
  const d = data as { scoredEventIds?: unknown; activeSeasonId?: unknown; label?: unknown } | undefined;
  const ids = d?.scoredEventIds;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isNonEmptyString)) return null;
  if (!isNonEmptyString(d?.activeSeasonId) || !isNonEmptyString(d?.label)) return null;
  return { scoredEventIds: toScoredEventIds(ids), seasonId: d.activeSeasonId, label: d.label };
};

/** `app_state/season_calendar`, restored to the `Event` shape; lock times come from the schedule. */
export const parseSeasonCalendar = (data: unknown): Event[] | null => {
  const events = (data as { events?: unknown } | undefined)?.events;
  if (!Array.isArray(events) || events.length === 0) return null;
  const valid = events.every((e) => isNonEmptyString(e?.id) && typeof e.round === 'number'
    && isNonEmptyString(e.name) && typeof e.country === 'string' && typeof e.location === 'string'
    && typeof e.circuit === 'string' && typeof e.hasSprint === 'boolean');
  if (!valid) return null;
  return events
    .map(({ id, round, name, country, location, circuit, hasSprint }) => (
      { id, round, name, country, location, circuit, hasSprint, lockAtUtc: '', softDeadlineUtc: '' }
    ))
    .sort((a, b) => a.round - b.round);
};
