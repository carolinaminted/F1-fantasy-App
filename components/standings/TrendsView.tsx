import React, { useMemo, useState } from 'react';
import {
  Tile, StatTile, SectionHeader, SegmentedControl, Meter, Chip, EmptyState,
  teamColor, NUMERIC, type Segment,
} from '../ui/index.ts';
import { TrendingUpIcon } from '../icons/TrendingUpIcon.tsx';
import { TeamIcon } from '../icons/TeamIcon.tsx';
import { DriverIcon } from '../icons/DriverIcon.tsx';
import { ProfileIcon } from '../icons/ProfileIcon.tsx';
import { summarizeTrends, type TrendEntity } from '../../services/pickTrends.ts';
import type { PickSelection, PickTrends, Driver, Constructor, Event } from '../../types.ts';

type EntityType = TrendEntity;
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
  trends: PickTrends;
  /** The reader's own season picks, for the alignment stat. Nobody else's reach the device. */
  ownPicks: { [eid: string]: PickSelection } | null;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
  isLoading: boolean;
}

interface Row { id: string; name: string; count: number; color?: string; teamName?: string }

/**
 * What the league is picking, over a window of recent events with results, and whether the
 * reader's lineups track the consensus or fade it. The counts are server-computed
 * (app_state/pick_trends), so an upcoming event's picks are never shown before it runs.
 */
export const TrendsView: React.FC<TrendsViewProps> = ({
  trends, ownPicks, allDrivers, allConstructors, events, isLoading,
}) => {
  const [entityType, setEntityType] = useState<EntityType>('drivers');
  const [window, setWindow] = useState<Window>('all');

  const { rows, picksCounted, eventsCounted, yourAlignment } = useMemo(() => {
    const source: (Driver | Constructor)[] = entityType === 'teams' ? allConstructors : allDrivers;
    const summary = summarizeTrends(trends, ownPicks, events, source, entityType, window === 'all' ? null : parseInt(window, 10));
    const built: Row[] = summary.ranked.map(({ entity: e, count }) => {
      const constructorId = entityType === 'teams' ? e.id : (e as Driver).constructorId;
      return {
        id: e.id,
        name: e.name,
        count,
        color: teamColor(constructorId, allConstructors),
        teamName: entityType === 'drivers'
          ? allConstructors.find(c => c.id === constructorId)?.name
          : undefined,
      };
    });
    return { rows: built, picksCounted: summary.picksCounted, eventsCounted: summary.eventsCounted, yourAlignment: summary.yourAlignment };
  }, [trends, ownPicks, allDrivers, allConstructors, events, entityType, window]);

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
              description="Trends appear once a race has results." />
          </Tile>
        )}
      </div>
    </div>
  );
};
