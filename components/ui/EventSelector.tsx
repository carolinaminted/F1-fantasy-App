
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Event, RaceResults } from '../../types.ts';
import { ChevronDownIcon } from '../icons/ChevronDownIcon.tsx';
import { Chip } from './Chip.tsx';
import { EVENT_FILTERS, classifyEvent, matchesEventFilter, orderEventsUpcomingFirst } from '../../utils/eventStatus.ts';

interface EventSelectorProps {
    events: Event[];
    selectedEventId: string | null;
    onSelect: (event: Event) => void;
    placeholder?: string;
    // Feed both so the tabs mean the same thing here as everywhere else: 'completed' is a
    // scored race, 'upcoming' excludes anything cancelled. Omitting them degrades gracefully —
    // every race then reads as upcoming or unscored on date alone.
    raceResults?: RaceResults;
    cancelledEventIds?: Set<string>;
    // Right-hand side of a list row. Defaults to Cancelled/Scored chips; override for a page
    // that has richer status of its own to show.
    renderStatus?: (event: Event) => React.ReactNode;
    disabled?: boolean;
    // 'schedule' keeps the season order it was handed. 'upcoming-first' puts the next race at the
    // top, then the rest of the season, then finished races most-recent-first. The All filter
    // always overrides either mode with explicit round order so the complete season reads R1-R24.
    orderBy?: 'schedule' | 'upcoming-first';
    // Which edge the open panel is pinned to. The panel can be wider than its trigger, so it
    // grows toward the opposite side: 'left' grows rightward, 'right' grows leftward. Pick the
    // one that grows into the page rather than off it.
    align?: 'left' | 'right';
}

export const EventSelector: React.FC<EventSelectorProps> = ({
    events,
    selectedEventId,
    onSelect,
    placeholder = "Select Event...",
    raceResults,
    cancelledEventIds,
    renderStatus,
    disabled,
    orderBy = 'schedule',
    align = 'left'
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const statusContext = useMemo(
        () => ({ raceResults, cancelledEventIds }),
        [raceResults, cancelledEventIds]
    );
    // Always open on Upcoming. Once the season has no race left to run there is nothing to open
    // it on, so fall back to All — never to Completed, which would bury the whole season.
    const [activeFilter, setActiveFilter] = useState<string>(() =>
        events.some(e => matchesEventFilter(e, 'upcoming', { raceResults, cancelledEventIds }))
            ? 'upcoming'
            : 'all'
    );
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Force close if disabled state changes to true
    useEffect(() => {
        if (disabled) {
            setIsDropdownOpen(false);
        }
    }, [disabled]);

    const filteredEvents = useMemo(() => {
        const matching = events.filter(event => matchesEventFilter(event, activeFilter, statusContext));

        if (activeFilter === 'all') {
            return [...matching].sort((a, b) => a.round - b.round);
        }

        return orderBy === 'upcoming-first' ? orderEventsUpcomingFirst(matching) : matching;
    }, [events, activeFilter, statusContext, orderBy]);

    // What a row shows when the page has nothing more specific to say. Cancelled matters most —
    // it is the only way a called-off race is distinguishable in the All list.
    const defaultStatus = (event: Event) => {
        const status = classifyEvent(event, statusContext);
        if (status === 'cancelled') return <Chip label="Cancelled" tone="danger" size="xs" />;
        if (status === 'completed') return <Chip label="Scored" tone="success" size="xs" />;
        return null;
    };

    const handleSelect = (event: Event) => {
        onSelect(event);
        setIsDropdownOpen(false);
    };

    const selectedEvent = events.find(e => e.id === selectedEventId);

    // While open, the selector lifts itself above its siblings. It can still be trapped by an
    // ancestor that creates a stacking context — a backdrop-blur wrapper will do it — so a
    // container that holds a selector above other content needs its own z-index too.
    return (
        <div
            className={`relative w-full md:w-64 ${isDropdownOpen ? 'z-50' : ''}`}
            ref={dropdownRef}
        >
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full bg-carbon-black border border-accent-gray rounded-lg shadow-sm py-1.5 pl-3 pr-8 text-pure-white font-semibold transition-all text-sm h-9 text-left relative flex items-center ${
                    disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'focus:outline-none focus:ring-1 focus:ring-primary-red focus:border-transparent'
                }`}
            >
                <span className="block truncate w-full">
                    {selectedEvent ? selectedEvent.name : placeholder}
                </span>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-highlight-silver">
                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isDropdownOpen && !disabled && (
                <div className={`absolute top-full mt-1 w-full min-w-[15rem] max-w-[calc(100vw-2rem)] ${align === 'right' ? 'right-0' : 'left-0'} bg-accent-gray border border-pure-white/10 rounded-xl shadow-2xl max-h-80 overflow-hidden flex flex-col animate-fade-in-down z-50`}>
                    <div className="shrink-0 p-2 bg-carbon-black/95 border-b border-pure-white/10 flex flex-wrap gap-1 backdrop-blur-sm sticky top-0 z-50">
                        {EVENT_FILTERS.map(filter => (
                            <button
                                key={filter.value}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveFilter(filter.value); }}
                                className={`flex-1 min-w-fit px-2 py-1 text-[10px] font-bold rounded-lg transition-colors border whitespace-nowrap ${
                                    activeFilter === filter.value
                                    ? 'bg-primary-red text-pure-white border-primary-red'
                                    : 'bg-carbon-black text-highlight-silver border-pure-white/10 hover:border-highlight-silver hover:text-pure-white'
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                    <div className="overflow-y-auto custom-scrollbar">
                        {filteredEvents.length > 0 ? (
                            filteredEvents.map(event => (
                                <button
                                    key={event.id}
                                    onClick={() => handleSelect(event)}
                                    className={`w-full text-left px-3 py-2 border-b border-pure-white/5 last:border-0 hover:bg-pure-white/5 transition-colors flex items-center justify-between group ${selectedEventId === event.id ? 'bg-pure-white/10' : ''}`}
                                >
                                    <div>
                                        <div className="font-bold text-pure-white text-xs">R{event.round}: {event.name}</div>
                                        <div className="text-[10px] text-highlight-silver">{event.location}</div>
                                    </div>
                                    {renderStatus ? renderStatus(event) : defaultStatus(event)}
                                </button>
                            ))
                        ) : (
                            <div className="p-3 text-center text-highlight-silver text-xs">
                                No events found.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
