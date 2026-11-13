import { parseLeagueDate } from '../utils/dateUtils.ts';
import type { Event, PickSelection, PickTrends } from '../types.ts';

export type TrendEntity = 'drivers' | 'teams';

const slotsOf = (picks: PickSelection, entity: TrendEntity) =>
  (entity === 'teams'
    ? [...(picks.aTeams || []), picks.bTeam]
    : [...(picks.aDrivers || []), ...(picks.bDrivers || [])]
  ).filter(Boolean) as string[];

/**
 * The Popular view's numbers: how often each entity was picked over the last `window` events with
 * results (all of them when null), ranked, and how often the reader's own picks land in the top
 * third. Counts come from app_state/pick_trends; only the reader's own picks are on the device.
 */
export const summarizeTrends = <T extends { id: string; name: string }>(
  trends: PickTrends,
  ownPicks: { [eventId: string]: PickSelection } | null,
  events: Event[],
  entities: T[],
  entity: TrendEntity,
  window: number | null,
) => {
  const counted = events
    .filter(e => trends.events[e.id])
    .sort((a, b) => (parseLeagueDate(a.lockAtUtc)?.getTime() || 0) - (parseLeagueDate(b.lockAtUtc)?.getTime() || 0));
  const relevant = window === null ? counted : counted.slice(-window);

  const counts: Record<string, number> = {};
  entities.forEach(e => { counts[e.id] = 0; });
  let picksCounted = 0;
  relevant.forEach(e => {
    Object.entries(trends.events[e.id][entity] || {}).forEach(([id, n]) => {
      // An entity no longer on the grid is not shown, so it is not counted either.
      if (counts[id] !== undefined) { counts[id] += n; picksCounted += n; }
    });
  });

  const ranked = entities
    .map(e => ({ entity: e, count: counts[e.id] }))
    .sort((a, b) => b.count !== a.count ? b.count - a.count : a.entity.name.localeCompare(b.entity.name));

  let yourAlignment: number | null = null;
  if (ownPicks) {
    const popular = new Set(ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 3))).map(r => r.entity.id));
    let mine = 0, withCrowd = 0;
    relevant.forEach(e => {
      if (!ownPicks[e.id]) return;
      slotsOf(ownPicks[e.id], entity).forEach(id => { mine++; if (popular.has(id)) withCrowd++; });
    });
    if (mine > 0) yourAlignment = Math.round((withCrowd / mine) * 100);
  }

  return { ranked, picksCounted, eventsCounted: relevant.length, yourAlignment };
};
