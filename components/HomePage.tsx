// Fix: Implement the HomePage component to act as the main screen for making picks.
import React, { useState, useMemo } from 'react';
import PicksForm from './PicksForm';
import { EVENTS } from '../constants';
import { Event } from '../types';

const HomePage: React.FC = () => {
  const upcomingEvent = useMemo(() => {
    const now = new Date().getTime();
    // Find the next event that hasn't locked yet
    return EVENTS.find(e => new Date(e.lockAtUtc).getTime() > now) || EVENTS[0];
  }, []);
  
  const [selectedEvent, setSelectedEvent] = useState<Event>(upcomingEvent);

  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white">F1 Fantasy 2026</h1>
        <div className="relative">
            <label htmlFor="event-selector" className="sr-only">Select Event</label>
            <select
                id="event-selector"
                value={selectedEvent.id}
                onChange={(e) => {
                    const event = EVENTS.find(ev => ev.id === e.target.value);
                    if (event) setSelectedEvent(event);
                }}
                className="w-full md:w-72 bg-gray-900/70 border border-gray-700 rounded-md shadow-sm py-2 pl-3 pr-10 text-white focus:outline-none focus:ring-[#ff8400] focus:border-[#ff8400] appearance-none"
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
      <PicksForm event={selectedEvent} />
    </div>
  );
};

export default HomePage;
