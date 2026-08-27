import React, { useMemo, useState } from 'react';
import {
  Tile, StatTile, SectionHeader, SegmentedControl, Meter, Chip, EmptyState,
  teamColor, NUMERIC, type Segment,
} from '../ui/index.ts';
import { TrendingUpIcon } from '../icons/TrendingUpIcon.tsx';
import { TeamIcon } from '../icons/TeamIcon.tsx';
import { DriverIcon } from '../icons/DriverIcon.tsx';
import { ProfileIcon } from '../icons/ProfileIcon.tsx';
import { parseLeagueDate } from '../../utils/dateUtils.ts';
import type { User, PickSelection, Driver, Constructor, Event } from '../../types.ts';

type EntityType = 'drivers' | 'teams';
type Window = 'all' | '3' | '5' | '8';

const ENTITY_SEGMENTS: Segment<EntityType>[] = [
  { value: 'drivers', label: 'Drivers', icon: DriverIcon },
  { value: 'teams',   label: 'Teams',   icon: TeamIcon },
];

const WINDOW_SEGMENTS: Segment<Window>[] = [
  { value: 'all', label: 'Season' },
  { value: '3',   label: 'Last 3' },
  { value: '5',   label: 'Last 5' },
  { value: '8',   label: 'Last 8' },
];

interface TrendsViewProps {
  allLeaguePicks: { [uid: string]: { [eid: string]: PickSelection } };
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
  isLoading: boolean;
  cancelledEventIds: Set<string>;
  currentUser: User | null;
}

interface Row { id: string; name: string; count: number; color?: string; teamName?: string }

/**
 * What the league is picking.
 *
 * The counting is unchanged — every member's picks over a window of recent events. What is
 * new is the reader's side of it: whether your lineups track the consensus or fade it. The
 * picks were already loaded to build these bars; nobody was comparing them to yours.
 */
export const TrendsView: React.FC<TrendsViewProps> = ({
  allLeaguePicks, allDrivers, allConstructors, events, isLoading, cancelledEventIds, currentUser,
}) => {
  const [entityType, setEntityType] = useState<EntityType>('drivers');
  const [window, setWindow] = useState<Window>('all');

  const { rows, picksCounted, eventsCounted, yourAlignment } = useMemo(() => {
    const empty = { rows: [] as Row[], picksCounted: 0, eventsCounted: 0, yourAlignment: null as number | null };
    if (Object.keys(allLeaguePicks).length === 0) return empty;

    const eventIdsWithPicks = new Set<string>();
    Object.values(allLeaguePicks).forEach(p => Object.keys(p).forEach(id => eventIdsWithPicks.add(id)));

    const completed = events
      .filter(e => eventIdsWithPicks.has(e.id) && !cancelledEventIds.has(e.id))
      .sort((a, b) =>
        (parseLeagueDate(a.lockAtUtc)?.getTime() || 0) - (parseLeagueDate(b.lockAtUtc)?.getTime() || 0));

    const relevant = window === 'all' ? completed : completed.slice(-parseInt(window, 10));
    const relevantIds = new Set(relevant.map(e => e.id));

    const counts: Record<string, number> = {};
    (entityType === 'teams' ? allConstructors : allDrivers).forEach(e => { counts[e.id] = 0; });

    let total = 0;
    Object.values(allLeaguePicks).forEach(userPicks => {
      Object.entries(userPicks).forEach(([eventId, picks]) => {
        if (!relevantIds.has(eventId)) return;
        const ids = entityType === 'teams'
          ? [...(picks.aTeams || []), picks.bTeam]
          : [...(picks.aDrivers || []), ...(picks.bDrivers || [])];
        ids.filter(Boolean).forEach(id => {
          if (counts[id as string] !== undefined) { counts[id as string]++; total++; }
        });
      });
    });

    const source: (Driver | Constructor)[] = entityType === 'teams' ? allConstructors : allDrivers;
    const built: Row[] = source
      .map(e => {
        const constructorId = entityType === 'teams' ? e.id : (e as Driver).constructorId;
        return {
          id: e.id,
          name: e.name,
          count: counts[e.id] ?? 0,
          color: teamColor(constructorId, allConstructors),
          teamName: entityType === 'drivers'
            ? allConstructors.find(c => c.id === constructorId)?.name
            : undefined,
        };
      })
      .sort((a, b) => b.count !== a.count ? b.count - a.count : a.name.localeCompare(b.name));

    // How often the reader's picks land on options the league also favours (top third).
    let alignment: number | null = null;
    if (currentUser && allLeaguePicks[currentUser.id]) {
      const popular = new Set(built.slice(0, Math.max(1, Math.ceil(built.length / 3))).map(r => r.id));
      let mine = 0, withCrowd = 0;
      Object.entries(allLeaguePicks[currentUser.id]).forEach(([eventId, picks]) => {
        if (!relevantIds.has(eventId)) return;
        const ids = entityType === 'teams'
          ? [...(picks.aTeams || []), picks.bTeam]
          : [...(picks.aDrivers || []), ...(picks.bDrivers || [])];
        ids.filter(Boolean).forEach(id => { mine++; if (popular.has(id as string)) withCrowd++; });
      });
      if (mine > 0) alignment = Math.round((withCrowd / mine) * 100);
    }

    return { rows: built, picksCounted: total, eventsCounted: relevant.length, yourAlignment: alignment };
  }, [allLeaguePicks, allDrivers, allConstructors, events, cancelledEventIds, entityType, window, currentUser]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
        <div className="w-10 h-10 rounded-full border-2 border-accent-gray border-t-primary-red animate-spin mb-4" />
        <p className="text-sm text-highlight-silver">Analysing league trends…</p>
      </div>
    );
  }

  const picked = rows.filter(r => r.count > 0);
  const mostPicked = picked[0];
  const contrarian = picked[picked.length - 1];
  const max = mostPicked?.count || 1;
  const label = entityType === 'teams' ? 'Team' : 'Driver';

  return (
    <div className="flex flex-col md:h-full gap-6 animate-fade-in pb-24 md:pb-safe pt-1 md:overflow-y-auto custom-scrollbar pr-1">
      <div>
        <SectionHeader
          title="Trends"
          subtitle={`What the league is picking · ${eventsCounted} ${eventsCounted === 1 ? 'event' : 'events'}`}
          icon={TrendingUpIcon}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label={`Most-picked ${label}`}
            value={mostPicked?.count ?? '—'}
            unit={mostPicked ? 'picks' : undefined}
            deltaLabel={mostPicked?.name}
            icon={TrendingUpIcon}
          />
          <StatTile
            label="Most Contrarian"
            value={contrarian?.count ?? '—'}
            unit={contrarian ? 'picks' : undefined}
            deltaLabel={contrarian?.name}
          />
          <StatTile label="Picks Analysed" value={picksCounted.toLocaleString()} unit="total" />
          <StatTile
            label="You vs. the Field"
            value={yourAlignment !== null ? `${yourAlignment}%` : '—'}
            deltaLabel={
              yourAlignment === null ? 'no picks in range'
                : yourAlignment >= 60 ? 'you back the consensus'
                : yourAlignment >= 35 ? 'balanced' : 'you fade the crowd'
            }
            icon={ProfileIcon}
            accent="fl"
          />
        </div>
      </div>

      <div>
        <SectionHeader
          title={`${label} Popularity`}
          subtitle="Times selected across the chosen window"
          action={<SegmentedControl segments={ENTITY_SEGMENTS} value={entityType} onChange={v => setEntityType(v)} size="sm" />}
        />
        <div className="mb-3">
          <SegmentedControl segments={WINDOW_SEGMENTS} value={window} onChange={v => setWindow(v)} size="sm" scrollable />
        </div>

        {picked.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-1">
            {rows.map((row, i) => (
              <div key={row.id} className="flex items-center gap-3 py-2">
                <span className={`w-8 text-right text-xs font-black ${NUMERIC} ${i < 3 ? 'text-pure-white' : 'text-highlight-silver/70'}`}>
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-pure-white truncate">
                      {row.name}
                      {row.teamName && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-highlight-silver/70">
                          {row.teamName}
                        </span>
                      )}
                    </span>
                    <span className={`text-sm font-bold shrink-0 ${NUMERIC} text-highlight-silver`}>{row.count}</span>
                  </div>
                  <Meter value={row.count} max={max} color={row.color} size="sm" className="mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Tile padding="none">
            <EmptyState icon={TrendingUpIcon} title="No picks to analyse"
              description="Trends appear once league members have submitted lineups." />
          </Tile>
        )}
      </div>
    </div>
  );
};
