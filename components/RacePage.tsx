import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import HomePage from './HomePage.tsx';
import SchedulePage from './SchedulePage.tsx';
import { SegmentedControl, type Segment } from './ui/index.ts';
import { PicksIcon } from './icons/PicksIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import type { Page } from '../App.tsx';
import type {
  User, PickSelection, RaceResults, PointsSystem, Driver, Constructor, EventSchedule, Event,
} from '../types.ts';

export type RaceView = 'picks' | 'weekend' | 'results';

const VIEWS: Segment<RaceView>[] = [
  { value: 'picks',   label: 'Picks',   icon: PicksIcon },
  { value: 'weekend', label: 'Weekend', icon: CalendarIcon },
  { value: 'results', label: 'Results', icon: TrophyIcon },
];

const isRaceView = (v: string | null): v is RaceView =>
  v === 'picks' || v === 'weekend' || v === 'results';

interface RacePageProps {
  user: User | null;
  seasonPicks: { [eventId: string]: PickSelection };
  onPicksSubmit: (eventId: string, picks: PickSelection) => void;
  formLocks: { [eventId: string]: boolean };
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
  cancelledEventIds: Set<string>;
  schedules: { [eventId: string]: EventSchedule };
  raceResults: RaceResults;
  onRefresh: () => Promise<void>;
  setActivePage: (page: Page, params?: { eventId?: string }) => void;
  targetEventId?: string | null;
}

/**
 * The event-centric hub. Absorbs three destinations that were always one subject:
 * `picks`, `schedule`, and `gp-results` — the last of which was literally SchedulePage
 * with a flag set.
 *
 * The view lives in the URL (`/race?view=results`) so a specific view is linkable.
 * The two hosted components are unchanged: Picks is event-centric and keeps its own
 * event selector, while Weekend and Results are calendar views over the whole season.
 */
const RacePage: React.FC<RacePageProps> = ({
  user, seasonPicks, onPicksSubmit, formLocks, pointsSystem, allDrivers, allConstructors,
  events, cancelledEventIds, schedules, raceResults, onRefresh, setActivePage, targetEventId,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('view');
  const view: RaceView = isRaceView(raw) ? raw : 'picks';

  const setView = (next: RaceView) => {
    const params = new URLSearchParams(searchParams);
    params.set('view', next);
    setSearchParams(params, { replace: true });
  };

  const body = useMemo(() => {
    if (view === 'picks') {
      if (!user) return null;
      return (
        <HomePage
          user={user}
          seasonPicks={seasonPicks}
          onPicksSubmit={onPicksSubmit}
          formLocks={formLocks}
          pointsSystem={pointsSystem}
          allDrivers={allDrivers}
          allConstructors={allConstructors}
          events={events}
          initialEventId={targetEventId}
          cancelledEventIds={cancelledEventIds}
          raceResults={raceResults}
        />
      );
    }
    return (
      <SchedulePage
        schedules={schedules}
        events={events}
        onRefresh={onRefresh}
        raceResults={raceResults}
        setActivePage={setActivePage}
        cancelledEventIds={cancelledEventIds}
        allDrivers={allDrivers}
        allConstructors={allConstructors}
        initialEventId={targetEventId}
        initialViewResults={view === 'results'}
        detailMode={view === 'results' ? 'inline' : 'modal'}
      />
    );
  }, [
    view, user, seasonPicks, onPicksSubmit, formLocks, pointsSystem, allDrivers,
    allConstructors, events, cancelledEventIds, schedules, raceResults, onRefresh,
    setActivePage, targetEventId,
  ]);

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex-none flex justify-center px-4 pt-2 md:pt-4">
        <SegmentedControl segments={VIEWS} value={view} onChange={v => setView(v)} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {body}
      </div>
    </div>
  );
};

export default RacePage;
