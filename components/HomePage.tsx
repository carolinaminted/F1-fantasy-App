// Fix: Implement the HomePage component to act as the main screen for making picks.
import React, { useState } from 'react';
import PicksForm from './PicksForm.tsx';
import { RACE_RESULTS, CURRENT_SEASON } from '../constants.ts';
import { Event, PickSelection, User, PointsSystem, Driver, Constructor } from '../types.ts';
import useFantasyData from '../hooks/useFantasyData.ts';
import { PicksIcon } from './icons/PicksIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';

interface HomePageProps {
  user: User;
  seasonPicks: { [eventId: string]: PickSelection };
  onPicksSubmit: (eventId: string, picks: PickSelection) => void;
  formLocks: { [eventId: string]: boolean };
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
  initialEventId?: string | null;
}

const HomePage: React.FC<HomePageProps> = ({ user, seasonPicks, onPicksSubmit, formLocks, pointsSystem, allDrivers, allConstructors, events, initialEventId }) => {
  // Default to the first upcoming (open) event.
  const [selectedEvent, setSelectedEvent] = useState<Event>(() => {
    // 0. Pre-selection from navigation
    if (initialEventId) {
        const target = events.find(e => e.id === initialEventId);
        if (target) return target;
    }

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

  // Check dues status
  const isDuesPaid = user.duesPaidStatus === 'Paid';

  // Selector Component extracted for cleaner render in PageHeader
  // Updated: Changed md:w-80 to md:w-64 for better alignment and header space conservation.
  const EventSelector = (
      <div className="relative w-full md:w-64">
          <label htmlFor="event-selector" className="sr-only">Select Event</label>
          <select
              id="event-selector"
              value={selectedEvent.id}
              onChange={(e) => {
                  const event = events.find(ev => ev.id === e.target.value);
                  if (event) setSelectedEvent(event);
              }}
              className="w-full bg-carbon-black/70 border border-accent-gray rounded-xl shadow-sm py-3 px-4 text-pure-white font-bold focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent appearance-none transition-all cursor-pointer hover:border-highlight-silver"
          >
              {events.map(event => {
                  const isLocked = formLocks[event.id] || Date.now() >= new Date(event.lockAtUtc).getTime();
                  return (
                      <option key={event.id} value={event.id}>
                         {isLocked ? '🔒' : '🟢'} R{event.round}: {event.name}
                      </option>
                  );
              })}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-highlight-silver">
            <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
      </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-0 md:px-4 flex flex-col md:h-[calc(100vh-6rem)]">
      {/* Unified Header */}
      <PageHeader 
          title="Grand Prix Picks" 
          icon={PicksIcon} 
          rightAction={EventSelector}
      />
      
      {/* Form Container: Scrollable on mobile, strictly fitted on Desktop (internal scroll if needed) */}
      <div className="flex-1 md:overflow-y-auto md:min-h-0 custom-scrollbar pb-safe relative">
          
          {/* Unpaid Dues Overlay */}
          {!isDuesPaid && (
            <div className="absolute inset-0 z-50 bg-carbon-black/80 backdrop-blur-md flex items-center justify-center p-6 h-full">
                <div className="bg-carbon-fiber border border-primary-red/50 rounded-xl p-8 max-w-lg text-center shadow-[0_0_50px_rgba(218,41,28,0.3)] ring-1 ring-pure-white/10 animate-fade-in-up">
                    <div className="w-20 h-20 bg-primary-red/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary-red/30 shadow-[0_0_20px_rgba(218,41,28,0.2)]">
                        <DuesIcon className="w-10 h-10 text-primary-red" />
                    </div>
                    
                    <h2 className="text-3xl font-black text-pure-white mb-3 uppercase italic tracking-tighter">
                        Pit Lane Closed
                    </h2>
                    
                    <p className="text-highlight-silver mb-8 text-base leading-relaxed">
                        Your entry fees for the <span className="text-pure-white font-bold">{CURRENT_SEASON}</span> season are outstanding. You cannot submit picks until your dues are settled.
                    </p>
                    
                    <div className="bg-carbon-black/40 p-5 rounded-lg border border-pure-white/10 text-sm text-highlight-silver/80 space-y-3">
                        <p>
                            Please navigate to the <strong className="text-pure-white">League Hub</strong> or tap your status on the <strong className="text-pure-white">Profile</strong> page to initiate payment.
                        </p>
                        <div className="h-px bg-pure-white/10 w-full my-2"></div>
                        <p className="text-xs italic opacity-70">
                            Once an Admin approves your payment, your team will be cleared to race immediately.
                        </p>
                    </div>
                </div>
            </div>
          )}

          <div className={`h-full ${!isDuesPaid ? 'opacity-20 pointer-events-none filter blur-[2px] overflow-hidden' : ''}`}>
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
      </div>
    </div>
  );
};

export default HomePage;