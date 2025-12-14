
// Fix: Implement the HomePage component to act as the main screen for making picks.
import React, { useState } from 'react';
import PicksForm from './PicksForm.tsx';
import { RACE_RESULTS } from '../constants.ts';
import { Event, PickSelection, User, PointsSystem, Driver, Constructor } from '../types.ts';
import useFantasyData from '../hooks/useFantasyData.ts';

interface HomePageProps {
  user: User;
  seasonPicks: { [eventId: string]: PickSelection };
  onPicksSubmit: (eventId: string, picks: PickSelection) => void;
  formLocks: { [eventId: string]: boolean };
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
}

const HomePage: React.FC<HomePageProps> = ({ user, seasonPicks, onPicksSubmit, formLocks, pointsSystem, allDrivers, allConstructors, events }) => {
  // Default to the first upcoming (open) event.
  const [selectedEvent, setSelectedEvent] = useState<Event>(() => {
    const now = Date.now();
    
    // 1. Priority: Find the first event that is TRULY Open (not time-locked AND not manually locked)
    const firstOpenEvent = events.find(event => {
        const lockTime = new Date(event.lockAtUtc).getTime();
        const isTimeLocked = now >= lockTime;
        const isManualLocked = !!formLocks[event.id]; // Strict boolean check
        return !isTimeLocked && !isManualLocked;
    });

    if (firstOpenEvent) return firstOpenEvent;

    // 2. Fallback: If no event is "Open" (e.g. admin locked next race early, or weekend started),
    // find the next event based on TIME only. This ensures we show the relevant "Upcoming" race
    // (even if it says LOCKED) rather than an old race from months ago.
    const nextEventByTime = events.find(event => {
        const lockTime = new Date(event.lockAtUtc).getTime();
        return now < lockTime;
    });

    if (nextEventByTime) return nextEventByTime;

    // 3. Final Fallback: End of season or valid data missing, show the last event.
    return events[events.length - 1] || events[0];
  });
  
  const fantasyData = useFantasyData(seasonPicks, RACE_RESULTS, pointsSystem, allDrivers, allConstructors);

  return (
    <div className="w-full max-w-7xl mx-auto px-0 md:px-4">
      {/* Event Selector - Compact on mobile */}
      <div className="flex flex-col md:flex-row justify-end md:items-center mb-4 md:mb-6 gap-2 md:gap-4 px-2 md:px-0">
        <div className="relative w-full md:w-auto">
            <label htmlFor="event-selector" className="sr-only">Select Event</label>
            <select
                id="event-selector"
                value={selectedEvent.id}
                onChange={(e) => {
                    const event = events.find(ev => ev.id === e.target.value);
                    if (event) setSelectedEvent(event);
                }}
                className="w-full md:w-80 bg-carbon-black/70 border border-accent-gray rounded-xl shadow-sm py-3 px-4 text-pure-white font-bold focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent appearance-none"
            >
                {events.map(event => {
                    const isLocked = formLocks[event.id] || Date.now() >= new Date(event.lockAtUtc).getTime();
                    return (
                        <option key={event.id} value={event.id}>
                           {isLocked ? '🔒' : '🟢'} Round {event.round}: {event.name}
                        </option>
                    );
                })}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-highlight-silver">
              <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
      </div>
      
      <PicksForm
        user={user}
        event={selectedEvent}
        initialPicksForEvent={seasonPicks[selectedEvent.id]}
        onPicksSubmit={onPicksSubmit}
        formLocks={formLocks}
        allConstructors={allConstructors}
        {...fantasyData}
      />
    </div>
  );
};

export default HomePage;
