import React, { useMemo } from 'react';
import { Page } from '../App.tsx';
import { BRAND } from '../brand.ts';
import {
  User, RaceResults, PointsSystem, Driver, Constructor, Event, PickSelection, LeaderboardCache,
} from '../types.ts';
import {
  Tile, StatTile, SectionHeader, Chip, Countdown, EmptyState, PageShell,
  CATEGORY_THEME, teamColor, withAlpha, NUMERIC,
} from './ui/index.ts';
import { PicksIcon } from './icons/PicksIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { useRaceStartEasterEgg, EasterEggOverlay } from './EasterEgg.tsx';
import { calculatePointsForEvent, calculateScoreRollup } from '../services/scoringService.ts';
import { parseLeagueDate } from '../utils/dateUtils.ts';

interface DashboardProps {
  user: User | null;
  setActivePage: (page: Page, params?: { eventId?: string }) => void;
  raceResults?: RaceResults;
  pointsSystem?: PointsSystem;
  allDrivers?: Driver[];
  allConstructors?: Constructor[];
  events: Event[];
  cancelledEventIds: Set<string>;
  seasonPicks?: { [eventId: string]: PickSelection };
  /** Populated once Standings has been visited. Never fetched from here. */
  leaderboardCache?: LeaderboardCache | null;
}

const isPicksComplete = (p?: PickSelection) =>
  !!p && p.aTeams?.every(Boolean) && !!p.bTeam && p.aDrivers?.every(Boolean)
      && p.bDrivers?.every(Boolean) && !!p.fastestLap;

const hasAnyResult = (r?: RaceResults[string]) =>
  !!r && (r.grandPrixFinish?.some(Boolean) || !!r.fastestLap || r.sprintFinish?.some(Boolean)
       || r.gpQualifying?.some(Boolean) || r.sprintQualifying?.some(Boolean));

/**
 * Home. Everything here is derived from listeners App.tsx already holds — season picks,
 * results, schedules, the user's public profile, and the leaderboard cache if Standings
 * has been opened. No surface on this page issues a Firestore read of its own.
 */
const Dashboard: React.FC<DashboardProps> = ({
  user, setActivePage, raceResults = {}, pointsSystem, allDrivers = [], allConstructors = [],
  events, cancelledEventIds, seasonPicks = {}, leaderboardCache,
}) => {
  const { easterEggState, activeLights, handleTriggerClick } = useRaceStartEasterEgg();

  const nextEvent = useMemo(() => {
    const now = Date.now();
    return events.find(e => {
      const lock = parseLeagueDate(e.lockAtUtc)?.getTime();
      return lock ? lock > now : false;
    });
  }, [events]);

  const lastScored = useMemo(() => {
    const scored = events.filter(e => hasAnyResult(raceResults[e.id]) && !cancelledEventIds.has(e.id));
    return scored[scored.length - 1];
  }, [events, raceResults, cancelledEventIds]);

  // Per-event points, for the sparkline and the last-GP capsule.
  const perEvent = useMemo(() => {
    if (!pointsSystem) return [] as { event: Event; points: number }[];
    return events
      .filter(e => hasAnyResult(raceResults[e.id]) && !cancelledEventIds.has(e.id))
      .map(e => {
        const picks = seasonPicks[e.id];
        const results = raceResults[e.id];
        if (!picks || !results) return { event: e, points: 0 };
        return { event: e, points: calculatePointsForEvent(picks, results, pointsSystem, allDrivers).totalPoints };
      });
  }, [events, raceResults, seasonPicks, pointsSystem, allDrivers, cancelledEventIds]);

  const rollup = useMemo(() => {
    if (!pointsSystem) return null;
    return calculateScoreRollup(seasonPicks, raceResults, pointsSystem, allDrivers, cancelledEventIds);
  }, [seasonPicks, raceResults, pointsSystem, allDrivers, cancelledEventIds]);

  const nextPicks = nextEvent ? seasonPicks[nextEvent.id] : undefined;
  const picksReady = isPicksComplete(nextPicks);
  const lastEventPoints = perEvent.length ? perEvent[perEvent.length - 1].points : null;

  const topFive = useMemo(() => (leaderboardCache?.users ?? []).slice(0, 5), [leaderboardCache]);

  const podium = useMemo(() => {
    if (!lastScored) return [];
    const finish = raceResults[lastScored.id]?.grandPrixFinish ?? [];
    return finish.slice(0, 3)
      .map(id => allDrivers.find(d => d.id === id))
      .filter((d): d is Driver => !!d);
  }, [lastScored, raceResults, allDrivers]);

  const totalPoints = user?.totalPoints ?? rollup?.totalPoints ?? 0;

  return (
    <PageShell>
      <EasterEggOverlay state={easterEggState} activeLights={activeLights} />

      {/* ---- Next race ---------------------------------------------------------- */}
      <div className="pt-4 md:pt-6">
        {nextEvent ? (
          <Tile glow padding="lg" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-carbon-fiber opacity-[0.07] pointer-events-none" />
            <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Chip label={`Round ${nextEvent.round}`} tone="neutral" size="xs" />
                  <Chip label="Next Grand Prix" tone="info" size="xs" />
                  {nextEvent.hasSprint && <Chip label="Sprint" tone="warning" size="xs" icon={SprintIcon} />}
                </div>

                {/* The five lights: still the easter egg trigger, now at a sane size. */}
                <button
                  onClick={handleTriggerClick}
                  aria-label={BRAND.name}
                  className="flex gap-1.5 mb-3"
                >
                  {[0, 1, 2, 3, 4].map(i => (
                    <span key={i}
                      className={`w-3 h-3 rounded-full transition-all duration-200 ${
                        activeLights > i
                          ? 'bg-primary-red shadow-[0_0_10px_rgba(218,41,28,0.9)]'
                          : 'bg-primary-red/25'
                      }`} />
                  ))}
                </button>

                <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-pure-white leading-none">
                  {nextEvent.name}
                </h1>
                <p className="text-sm text-highlight-silver mt-1.5">
                  {nextEvent.country} · {nextEvent.circuit}
                </p>
              </div>

              <div className="lg:w-72 shrink-0 flex flex-col gap-3">
                <Countdown targetDate={nextEvent.lockAtUtc} label="Picks lock in" size="md"
                           expiredLabel="Picks Locked" />
                <button
                  onClick={() => setActivePage('picks', { eventId: nextEvent.id })}
                  className="w-full h-12 rounded-xl bg-primary-red hover:opacity-90 text-pure-white font-bold uppercase tracking-wider text-sm transition-opacity shadow-lg shadow-primary-red/25"
                >
                  {picksReady ? 'Edit Picks' : 'Make Picks'}
                </button>
                <div className="flex justify-center">
                  {picksReady
                    ? <Chip label="Lineup submitted" tone="success" size="xs" />
                    : <Chip label={nextPicks ? 'Lineup incomplete' : 'No picks yet'} tone="warning" size="xs" />}
                </div>
              </div>
            </div>
          </Tile>
        ) : (
          <Tile padding="lg">
            <EmptyState icon={CheckeredFlagIcon} title="Season complete"
              description="No races remain on the calendar. See how the championship finished." 
              action={
                <button onClick={() => setActivePage('leaderboard')}
                  className="bg-primary-red text-pure-white font-bold py-2 px-5 rounded-lg text-sm">
                  View Standings
                </button>
              } />
          </Tile>
        )}
      </div>

      {/* ---- Your season -------------------------------------------------------- */}
      <div className="mt-8">
        <SectionHeader title="Your Season" icon={PicksIcon}
          action={
            <button onClick={() => setActivePage('profile')}
              className="text-[11px] font-bold uppercase tracking-wider text-highlight-silver hover:text-pure-white transition-colors">
              Full profile →
            </button>
          } />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Championship Rank" value={user?.rank ? `#${user.rank}` : '—'} icon={TrophyIcon} />
          <StatTile label="Total Points" value={totalPoints.toLocaleString()} unit="pts" />
          <StatTile label="Last Grand Prix" value={lastEventPoints ?? '—'} unit={lastEventPoints !== null ? 'pts' : undefined} />
          <StatTile label="Points Per Event" value={perEvent.length ? Math.round(perEvent.reduce((n, e) => n + e.points, 0) / perEvent.length) : '—'}
            sparkline={perEvent.map(e => e.points)} accent="gp" />
        </div>

        {rollup && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            {([
              ['gp', 'Grand Prix', rollup.grandPrixPoints],
              ['quali', 'Qualifying', rollup.gpQualifyingPoints + rollup.sprintQualifyingPoints],
              ['sprint', 'Sprint', rollup.sprintPoints],
              ['fl', 'Fastest Lap', rollup.fastestLapPoints],
            ] as const).map(([key, label, value]) => (
              <Tile key={key} accent={key} accentEdge padding="sm">
                <div className="text-[10px] uppercase tracking-wider text-highlight-silver font-bold">{label}</div>
                <div className={`text-xl font-black ${NUMERIC} ${CATEGORY_THEME[key].text}`}>{value}</div>
              </Tile>
            ))}
          </div>
        )}
      </div>

      {/* ---- Standings + last result ------------------------------------------- */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <SectionHeader title="Standings" icon={LeaderboardIcon}
            action={
              <button onClick={() => setActivePage('leaderboard')}
                className="text-[11px] font-bold uppercase tracking-wider text-highlight-silver hover:text-pure-white transition-colors">
                Full table →
              </button>
            } />
          {topFive.length > 0 ? (
            <Tile padding="sm">
              {topFive.map((u, i) => {
                const isYou = u.id === user?.id;
                return (
                  <div key={u.id}
                    className={`flex items-center gap-3 px-2 py-2.5 rounded-lg ${
                      isYou ? 'bg-purple-500/10 ring-1 ring-inset ring-purple-500/40' : ''
                    } ${i > 0 ? 'mt-0.5' : ''}`}>
                    <span className={`w-6 text-center font-black ${NUMERIC} ${i === 0 ? 'text-yellow-400' : 'text-highlight-silver'}`}>
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm font-bold text-pure-white">{u.displayName}</span>
                    <span className={`text-sm font-bold ${NUMERIC} text-highlight-silver`}>
                      {(u.totalPoints ?? 0).toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </Tile>
          ) : (
            <Tile padding="none">
              <EmptyState icon={LeaderboardIcon} title="Standings not loaded"
                description="Open Standings once and the top five will appear here."
                action={
                  <button onClick={() => setActivePage('leaderboard')}
                    className="bg-accent-gray hover:bg-accent-gray/80 text-pure-white font-bold py-2 px-5 rounded-lg text-sm transition-colors">
                    Open Standings
                  </button>
                } />
            </Tile>
          )}
        </div>

        <div>
          <SectionHeader title="Last Grand Prix" icon={CheckeredFlagIcon}
            action={
              <button onClick={() => setActivePage('gp-results')}
                className="text-[11px] font-bold uppercase tracking-wider text-highlight-silver hover:text-pure-white transition-colors">
                All results →
              </button>
            } />
          {lastScored ? (
            <Tile padding="md">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <span className="font-black uppercase italic tracking-tight text-pure-white truncate">
                  {lastScored.name}
                </span>
                {lastEventPoints !== null && (
                  <span className={`text-sm font-bold ${NUMERIC} text-primary-red shrink-0`}>
                    +{lastEventPoints} pts
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {podium.map((d, i) => {
                  const color = teamColor(d.constructorId, allConstructors);
                  return (
                    <div key={d.id}
                      style={color ? { borderColor: withAlpha(color, 0.45), backgroundColor: withAlpha(color, 0.1) } : undefined}
                      className="flex items-center gap-3 rounded-lg border border-pure-white/10 px-3 py-2">
                      <span className={`w-5 text-center text-xs font-black ${NUMERIC} text-highlight-silver`}>
                        P{i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm font-bold text-pure-white">{d.name}</span>
                      <span className="text-[10px] uppercase tracking-wider text-highlight-silver truncate">
                        {allConstructors.find(c => c.id === d.constructorId)?.name}
                      </span>
                    </div>
                  );
                })}
                {podium.length === 0 && (
                  <p className="text-sm text-highlight-silver py-2">Finishing order not recorded.</p>
                )}
              </div>
            </Tile>
          ) : (
            <Tile padding="none">
              <EmptyState icon={CheckeredFlagIcon} title="No results yet"
                description="The first Grand Prix of the season has not been scored." />
            </Tile>
          )}
        </div>
      </div>

      <div className="h-8" />
    </PageShell>
  );
};

export default Dashboard;
