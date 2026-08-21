import React, { useMemo, useState } from 'react';
import {
  Tile, StatTile, SectionHeader, SegmentedControl, Meter, EmptyState,
  teamColor, CATEGORY_THEME, NUMERIC, type Category, type Segment,
} from '../ui/index.ts';
import { ConstructorPodium } from './ConstructorPodium.tsx';
import { TeamIcon } from '../icons/TeamIcon.tsx';
import { DriverIcon } from '../icons/DriverIcon.tsx';
import { CheckeredFlagIcon } from '../icons/CheckeredFlagIcon.tsx';
import { PolePositionIcon } from '../icons/PolePositionIcon.tsx';
import { SprintIcon } from '../icons/SprintIcon.tsx';
import { FastestLapIcon } from '../icons/FastestLapIcon.tsx';
import type { RaceResults, PointsSystem, Driver, Constructor, Event } from '../../types.ts';

type SortKey = 'total' | Category;

const SORTS: Segment<SortKey>[] = [
  { value: 'total',  label: 'Overall' },
  { value: 'gp',     label: 'Race',   icon: CheckeredFlagIcon },
  { value: 'quali',  label: 'Quali',  icon: PolePositionIcon },
  { value: 'sprint', label: 'Sprint', icon: SprintIcon },
  { value: 'fl',     label: 'FL',     icon: FastestLapIcon },
];

interface DriverRow {
  id: string; name: string; teamName?: string; color?: string;
  total: number; gp: number; quali: number; sprint: number; fl: number;
}

interface EntityPointsViewProps {
  raceResults: RaceResults;
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
}

/**
 * League points earned by real drivers and constructors — distinct from Drivers & Teams,
 * which shows rosters.
 *
 * The per-driver category split was already being computed here and thrown away: only the
 * total was rendered, with four near-duplicate lists beside it. One list now carries the
 * composition inline, in the four category colors.
 */
export const EntityPointsView: React.FC<EntityPointsViewProps> = ({
  raceResults, pointsSystem, allDrivers, allConstructors, events,
}) => {
  const [sort, setSort] = useState<SortKey>('total');

  const { drivers, teams } = useMemo(() => {
    const d: Record<string, { total: number; gp: number; quali: number; sprint: number; fl: number }> = {};
    const t: Record<string, number> = {};
    allDrivers.forEach(x => { d[x.id] = { total: 0, gp: 0, quali: 0, sprint: 0, fl: 0 }; });
    allConstructors.forEach(x => { t[x.id] = 0; });

    events.forEach(event => {
      const results = raceResults[event.id];
      if (!results) return;

      const add = (driverId: string | null, pts: number, cat: Category) => {
        if (!driverId || !pts) return;
        if (d[driverId]) { d[driverId].total += pts; d[driverId][cat] += pts; }
        const teamId = results.driverTeams?.[driverId] || allDrivers.find(x => x.id === driverId)?.constructorId;
        if (teamId && t[teamId] !== undefined) t[teamId] += pts;
      };

      results.grandPrixFinish?.forEach((id, i) => add(id, pointsSystem.grandPrixFinish[i] || 0, 'gp'));
      results.sprintFinish?.forEach((id, i) => add(id, pointsSystem.sprintFinish[i] || 0, 'sprint'));
      results.gpQualifying?.forEach((id, i) => add(id, pointsSystem.gpQualifying[i] || 0, 'quali'));
      results.sprintQualifying?.forEach((id, i) => add(id, pointsSystem.sprintQualifying[i] || 0, 'quali'));
      if (results.fastestLap) add(results.fastestLap, pointsSystem.fastestLap || 0, 'fl');
    });

    const driverRows: DriverRow[] = allDrivers
      .map(x => ({
        id: x.id,
        name: x.name,
        teamName: allConstructors.find(c => c.id === x.constructorId)?.name,
        color: teamColor(x.constructorId, allConstructors),
        ...d[x.id],
      }))
      .filter(r => r.total > 0);

    const teamRows = allConstructors
      .map(c => ({ label: c.name, value: t[c.id] ?? 0, color: teamColor(c.id, allConstructors) }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value !== a.value ? b.value - a.value : a.label.localeCompare(b.label));

    return { drivers: driverRows, teams: teamRows };
  }, [raceResults, pointsSystem, allDrivers, allConstructors, events]);

  const sorted = useMemo(
    () => [...drivers].sort((a, b) => (b[sort] - a[sort]) || a.name.localeCompare(b.name)).slice(0, 12),
    [drivers, sort]
  );

  const topDriver = [...drivers].sort((a, b) => b.total - a.total)[0];
  const battle = teams.length >= 2 ? teams[0].value - teams[1].value : null;
  const max = sorted[0]?.[sort] || 1;

  if (drivers.length === 0 && teams.length === 0) {
    return (
      <div className="pt-4">
        <Tile padding="none">
          <EmptyState icon={TeamIcon} title="No points scored yet"
            description="Driver and constructor points appear once a Grand Prix has been scored." />
        </Tile>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pt-1 pb-24 md:pb-12 md:h-full md:overflow-y-auto custom-scrollbar px-1">
      <div>
        <SectionHeader
          title="Driver & Team Points"
          subtitle="League points earned by the real grid"
          icon={TeamIcon}
        />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatTile label="Leading Constructor" value={teams[0]?.value ?? '—'} unit="pts"
            deltaLabel={teams[0]?.label} icon={TeamIcon} />
          <StatTile label="Leading Driver" value={topDriver?.total ?? '—'} unit="pts"
            deltaLabel={topDriver?.name} icon={DriverIcon} />
          <StatTile label="Constructor Gap" value={battle ?? '—'} unit={battle !== null ? 'pts' : undefined}
            deltaLabel={teams.length >= 2 ? `${teams[0].label} over ${teams[1].label}` : undefined}
            className="col-span-2 lg:col-span-1" />
        </div>
      </div>

      <div>
        <SectionHeader title="Constructor Standings" subtitle="Points earned by both drivers per constructor" />
        <Tile padding="lg">
          <ConstructorPodium data={teams} />
        </Tile>
      </div>

      <div>
        <SectionHeader
          title="Driver Points"
          subtitle="Bar shows where each driver's points came from"
          icon={DriverIcon}
          action={<SegmentedControl segments={SORTS} value={sort} onChange={v => setSort(v)} size="sm" scrollable />}
        />
        <Tile padding="md">
          {sorted.map((row, i) => {
            const value = row[sort];
            const parts: [Category, number][] = [['gp', row.gp], ['quali', row.quali], ['sprint', row.sprint], ['fl', row.fl]];
            return (
              <div key={row.id} className={`flex items-center gap-3 ${i > 0 ? 'mt-3 pt-3 border-t border-pure-white/5' : ''}`}>
                <span className={`w-6 text-right text-xs font-black ${NUMERIC} text-highlight-silver/70`}>{i + 1}</span>
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
                    <span className={`text-sm font-bold shrink-0 ${NUMERIC} text-pure-white`}>{value}</span>
                  </div>

                  {sort === 'total' ? (
                    /* Composition: one bar, four category colors, proportional to the split. */
                    <div className="mt-1.5 flex h-1.5 w-full rounded-full overflow-hidden bg-carbon-black/80">
                      {parts.map(([cat, v]) => v > 0 && (
                        <div
                          key={cat}
                          className={CATEGORY_THEME[cat].bg}
                          style={{ width: `${(v / (row.total || 1)) * 100}%` }}
                          title={`${CATEGORY_THEME[cat].label}: ${v}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <Meter value={value} max={max} color={row.color} size="sm" className="mt-1.5" />
                  )}
                </div>
              </div>
            );
          })}

          {sort === 'total' && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-pure-white/10">
              {(['gp', 'quali', 'sprint', 'fl'] as Category[]).map(cat => (
                <span key={cat} className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-highlight-silver">
                  <span className={`w-2.5 h-1.5 rounded-full ${CATEGORY_THEME[cat].bg}`} />
                  {CATEGORY_THEME[cat].label}
                </span>
              ))}
            </div>
          )}
        </Tile>
      </div>
    </div>
  );
};
