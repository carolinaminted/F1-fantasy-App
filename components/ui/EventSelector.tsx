
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Event } from '../../types.ts';
import { ChevronDownIcon } from '../icons/ChevronDownIcon.tsx';

export interface FilterOption {
    label: string;
    value: string;
}

interface EventSelectorProps {
    events: Event[];
    selectedEventId: string | null;
    onSelect: (event: Event) => void;
    placeholder?: string;
    filters: FilterOption[];
    // Returns true if event matches the filter
    filterPredicate: (event: Event, filterValue: string) => boolean;
    // Returns a React Node to display on the right side of the list item (e.g. status dot)
    renderStatus?: (event: Event) => React.ReactNode;
    disabled?: boolean;
}

export const EventSelector: React.FC<EventSelectorProps> = ({
    events,
    selectedEventId,
    onSelect,
    placeholder = "Select Event...",
    filters,
    filterPredicate,
    renderStatus,
    disabled
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>(filters[0]?.value || 'all');
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
        return events.filter(event => {
            // 1. Check Filter Tab
            if (!filterPredicate(event, activeFilter)) return false;
            return true;
        });
    }, [events, activeFilter, filterPredicate]);

    const handleSelect = (event: Event) => {
        onSelect(event);
        setIsDropdownOpen(false);
    };

    const selectedEvent = events.find(e => e.id === selectedEventId);

    return (
        <div className="relative w-full md:w-64" ref={dropdownRef}>
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
                <div className="absolute top-full left-0 right-0 mt-1 bg-accent-gray border border-pure-white/10 rounded-xl shadow-2xl max-h-80 overflow-hidden flex flex-col animate-fade-in-down z-50">
                    <div className="flex-shrink-0 p-2 bg-carbon-black/95 border-b border-pure-white/10 flex gap-1 backdrop-blur-sm sticky top-0 z-50 overflow-x-auto no-scrollbar">
                        {filters.map(filter => (
                            <button
                                key={filter.value}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveFilter(filter.value); }}
                                className={`flex-1 px-2 py-1 text-[10px] font-bold rounded-lg transition-colors border whitespace-nowrap ${
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
                                    {renderStatus && renderStatus(event)}
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
