// Fix: Implement the HomePage component to act as the main screen for making picks.
import React, { useState } from 'react';
import PicksForm from './PicksForm';
import { EVENTS, RACE_RESULTS } from '../constants';
import { Event, PickSelection, User } from '../types';
import useFantasyData from '../hooks/useFantasyData';

interface HomePageProps {
  user: User;
  seasonPicks: { [eventId: string]: PickSelection };
  onPicksSubmit: (eventId: string, picks: PickSelection) => void;
}

const HomePage: React.FC<HomePageProps> = ({ user, seasonPicks, onPicksSubmit }) => {
  const [selectedEvent, setSelectedEvent] = useState<Event>(EVENTS[0]);
  const fantasyData = useFantasyData(seasonPicks, RACE_RESULTS);

  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      <div className="flex flex-col md:flex-row justify-end md:items-center mb-6 gap-4">
        <div className="relative">
            <label htmlFor="event-selector" className="sr-only">Select Event</label>
            <select
                id="event-selector"
                value={selectedEvent.id}
                onChange={(e) => {
                    const event = EVENTS.find(ev => ev.id === e.target.value);
                    if (event) setSelectedEvent(event);
                }}
                className="w-full md:w-72 bg-gray-900/70 border border-gray-700 rounded-md shadow-sm py-2 px-10 text-white focus:outline-none focus:ring-[#ff8400] focus:border-[#ff8400] appearance-none text-center"
            >
                {EVENTS.map(event => (
                    <option key={event.id} value={event.id}>
                       R{event.round}: {event.name}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
        </div>
      </div>
      <PicksForm
        user={user}
        event={selectedEvent}
        initialPicksForEvent={seasonPicks[selectedEvent.id]}
        onPicksSubmit={onPicksSubmit}
        {...fantasyData}
      />
    </div>
  );
};

export default HomePage;