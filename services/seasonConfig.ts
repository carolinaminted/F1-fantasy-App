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

/** The season lifecycle, advanced only by the Season Control callables. */
export type SeasonStatus = 'active' | 'concluded' | 'archived' | 'setup';
const SEASON_STATUSES: readonly string[] = ['active', 'concluded', 'archived', 'setup'];

/** A top-three finish as fixed when the season was concluded. */
export interface PodiumEntry {
  uid: string;
  displayName: string;
  totalPoints: number;
  finalRank: number;
}

export interface SeasonConfig {
  scoredEventIds: ScoredEventIds;
  seasonId: string;
  label: string;
  status: SeasonStatus;
  /** Set when the season is concluded; more than one on a tie. */
  champions: string[];
  /** Everyone at rank 3 or better when the season was concluded; empty before that. */
  finalPodium: PodiumEntry[];
}

const parsePodium = (value: unknown): PodiumEntry[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((p) => isNonEmptyString(p?.uid) && typeof p.displayName === 'string'
      && typeof p.totalPoints === 'number' && typeof p.finalRank === 'number')
    .map(({ uid, displayName, totalPoints, finalRank }) => ({ uid, displayName, totalPoints, finalRank }))
    .sort((a, b) => (a.finalRank - b.finalRank) || a.displayName.localeCompare(b.displayName));
};

const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export const parseSeasonConfig = (data: unknown): SeasonConfig | null => {
  const d = data as {
    scoredEventIds?: unknown; activeSeasonId?: unknown; label?: unknown; status?: unknown; champions?: unknown;
    finalPodium?: unknown;
  } | undefined;
  const ids = d?.scoredEventIds;
  if (typeof d?.status !== 'string' || !SEASON_STATUSES.includes(d.status)) return null;
  // Setup mode (between Start new season and Open season) has no scored events yet.
  const minIds = d.status === 'setup' ? 0 : 1;
  if (!Array.isArray(ids) || ids.length < minIds || !ids.every(isNonEmptyString)) return null;
  if (!isNonEmptyString(d.activeSeasonId) || !isNonEmptyString(d.label)) return null;
  const champions = Array.isArray(d.champions) ? d.champions.filter(isNonEmptyString) : [];
  return {
    scoredEventIds: toScoredEventIds(ids), seasonId: d.activeSeasonId, label: d.label,
    status: d.status as SeasonStatus, champions, finalPodium: parsePodium(d.finalPodium),
  };
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
