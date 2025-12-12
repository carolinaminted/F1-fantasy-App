
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RaceResults, Event, EventResult, Driver as DriverType, Constructor } from '../types.ts';
import { EVENTS } from '../constants.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';

interface GpResultsPageProps {
  raceResults: RaceResults;
  allDrivers: DriverType[];
  allConstructors: Constructor[];
}

const GpResultsPage: React.FC<GpResultsPageProps> = ({ raceResults, allDrivers, allConstructors }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'results' | 'pending'>('all');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Helper to check status
    const hasResults = (eventId: string) => {
        const r = raceResults[eventId];
        // Check if any significant data exists to consider "Results In"
        if (!r) return false;
        return (
            r.grandPrixFinish?.some(pos => !!pos) || 
            !!r.fastestLap ||
            r.sprintFinish?.some(pos => !!pos) ||
            r.gpQualifying?.some(pos => !!pos)
        );
    };

    const selectedEvent = useMemo(() => EVENTS.find(e => e.id === selectedEventId), [selectedEventId]);

    const filteredEvents = useMemo(() => {
        // Smart Search: If the input matches the selected event's name exactly,
        // we assume the user is just looking at the selection, not trying to filter.
        // In this case, we ignore the text filter so the full list (respecting status filter) is shown.
        const isExactMatch = selectedEvent && searchTerm === selectedEvent.name;
        const effectiveSearch = isExactMatch ? '' : searchTerm.toLowerCase();

        return EVENTS.filter(event => {
            // 1. Filter by Status
            const resultsIn = hasResults(event.id);
            if (filterStatus === 'results' && !resultsIn) return false;
            if (filterStatus === 'pending' && resultsIn) return false;

            // 2. Filter by Text
            if (!effectiveSearch) return true;
            return (
                event.name.toLowerCase().includes(effectiveSearch) ||
                event.country.toLowerCase().includes(effectiveSearch) ||
                event.round.toString().includes(effectiveSearch)
            );
        });
    }, [searchTerm, filterStatus, selectedEvent, raceResults]);

    const handleEventSelect = (event: Event) => {
        setSelectedEventId(event.id);
        setSearchTerm(event.name);
        setIsDropdownOpen(false);
    };

    const FilterButton: React.FC<{ label: string; value: typeof filterStatus }> = ({ label, value }) => (
        <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFilterStatus(value); }}
            className={`flex-1 px-2 py-2 text-xs font-bold rounded-lg transition-colors border ${
                filterStatus === value
                ? 'bg-primary-red text-pure-white border-primary-red'
                : 'bg-carbon-black text-highlight-silver border-pure-white/10 hover:border-highlight-silver hover:text-pure-white'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="max-w-6xl mx-auto text-pure-white px-4 md:px-0 pb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-pure-white mb-2 text-center pt-8">Grand Prix Results</h1>
            <p className="text-center text-highlight-silver mb-8">Official race classifications and points distribution.</p>
            
            {/* Search / Dropdown Bar */}
            <div className="relative max-w-2xl mx-auto mb-8 z-30" ref={dropdownRef}>
                <div className="relative group">
                    <input
                        type="text"
                        aria-label="Select Event"
                        placeholder="Search or Select a Grand Prix..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }}
                        onFocus={(e) => { setIsDropdownOpen(true); e.target.select(); }}
                        className="w-full bg-carbon-black border border-accent-gray rounded-xl shadow-lg py-4 pl-6 pr-12 text-pure-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-primary-red focus:border-transparent placeholder-highlight-silver/50 transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-highlight-silver group-focus-within:text-primary-red transition-colors">
                        <ChevronDownIcon className={`w-6 h-6 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                {/* Dropdown Menu */}
                {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-accent-gray border border-pure-white/10 rounded-xl shadow-2xl max-h-96 overflow-hidden flex flex-col animate-fade-in-down z-40">
                        {/* Filter Toggles Header */}
                        <div className="flex-shrink-0 p-2 bg-carbon-black/80 border-b border-pure-white/10 grid grid-cols-3 gap-2 backdrop-blur-sm sticky top-0 z-50">
                            <FilterButton label="All Events" value="all" />
                            <FilterButton label="Results In" value="results" />
                            <FilterButton label="Pending" value="pending" />
                        </div>

                        <div className="overflow-y-auto custom-scrollbar">
                            {filteredEvents.length > 0 ? (
                                filteredEvents.map(event => {
                                    const resultsIn = hasResults(event.id);
                                    return (
                                        <button
                                            key={event.id}
                                            onClick={() => handleEventSelect(event)}
                                            className={`w-full text-left px-6 py-4 border-b border-pure-white/5 last:border-0 hover:bg-pure-white/5 transition-colors flex items-center justify-between group ${selectedEventId === event.id ? 'bg-pure-white/10' : ''}`}
                                        >
                                            <div>
                                                <div className="font-bold text-pure-white group-hover:text-primary-red transition-colors text-lg">R{event.round}: {event.name}</div>
                                                <div className="text-sm text-highlight-silver">{event.country}</div>
                                            </div>
                                            {resultsIn ? (
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-green-600/20 text-green-400 px-3 py-1 rounded border border-green-600/30">
                                                    Results In
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold uppercase tracking-wider bg-pure-white/5 text-highlight-silver px-3 py-1 rounded border border-pure-white/10">
                                                    Pending
                                                </span>
                                            )}
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center text-highlight-silver">
                                    <p className="italic mb-2">No events found matching "{searchTerm}"</p>
                                    {filterStatus !== 'all' && (
                                        <button onClick={() => setFilterStatus('all')} className="text-primary-red font-bold text-sm hover:underline">
                                            Clear Filters
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            {/* Results Display Area */}
            {selectedEvent ? (
                <div className="animate-fade-in">
                    <div className="bg-accent-gray/30 backdrop-blur-md rounded-2xl p-6 md:p-8 ring-1 ring-pure-white/10 shadow-xl">
                        {/* Event Header */}
                        <div className="flex flex-col md:flex-row justify-between items-center border-b border-pure-white/10 pb-6 mb-6">
                            <div>
                                <h2 className="text-3xl md:text-4xl font-bold text-pure-white mb-2">{selectedEvent.name}</h2>
                                <p className="text-lg text-highlight-silver flex items-center gap-2">
                                    <span className="bg-pure-white/10 px-2 py-0.5 rounded text-sm font-bold uppercase">Round {selectedEvent.round}</span>
                                    {selectedEvent.country}
                                </p>
                            </div>
                            <div className="mt-4 md:mt-0">
                                {hasResults(selectedEvent.id) ? (
                                     <div className="flex items-center gap-2 text-green-400 bg-green-400/10 px-4 py-2 rounded-lg border border-green-400/20 shadow-[0_0_15px_rgba(74,222,128,0.1)]">
                                        <CheckeredFlagIcon className="w-6 h-6" />
                                        <span className="font-bold uppercase tracking-wider">Official Results</span>
                                     </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-highlight-silver bg-pure-white/5 px-4 py-2 rounded-lg border border-pure-white/10">
                                        <span className="font-bold uppercase tracking-wider text-sm">Awaiting Classification</span>
                                     </div>
                                )}
                            </div>
                        </div>

                        <EventDetails 
                            event={selectedEvent} 
                            results={raceResults[selectedEvent.id]} 
                            allDrivers={allDrivers} 
                            allConstructors={allConstructors} 
                        />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 opacity-40 border-2 border-dashed border-pure-white/10 rounded-2xl bg-pure-white/5">
                    <CheckeredFlagIcon className="w-32 h-32 text-highlight-silver mb-6" />
                    <p className="text-2xl text-highlight-silver font-medium">Select a Grand Prix from the dropdown above</p>
                </div>
            )}
        </div>
    );
};

// --- Sub-components for GpResultsPage ---

interface EventDetailsProps {
    event: Event;
    results: EventResult | undefined;
    allDrivers: DriverType[];
    allConstructors: Constructor[];
}

const EventDetails: React.FC<EventDetailsProps> = ({ event, results, allDrivers, allConstructors }) => {
    const [activeTab, setActiveTab] = useState('race');

    if (!results || !results.grandPrixFinish?.some(r => r)) {
        return (
            <div className="text-center py-16">
                <p className="text-xl text-highlight-silver mb-2">Results for this event are not yet available.</p>
                <p className="text-sm text-highlight-silver/50">Check back after the race weekend.</p>
            </div>
        );
    }

    const tabs = [
        { id: 'race', label: 'Race', icon: CheckeredFlagIcon },
        { id: 'quali', label: 'Qualifying', icon: PolePositionIcon },
        ...(event.hasSprint ? [{ id: 'sprint', label: 'Sprint', icon: SprintIcon }] : []),
        { id: 'fastestlap', label: 'Fastest Lap', icon: FastestLapIcon },
    ];
    
    return (
        <div>
            {/* Tabs: Grid on Mobile (2 columns), Flex on Desktop */}
            <div className="mb-6 md:mb-8">
                <div className="grid grid-cols-2 md:flex md:justify-center gap-3 md:gap-8 border-b-0 md:border-b border-accent-gray/50 pb-0 md:pb-1">
                {tabs.map(tab => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        aria-label={tab.label}
                        className={`
                            flex items-center justify-center gap-2 px-3 py-3 text-sm md:text-base font-bold transition-all rounded-lg md:rounded-b-none md:rounded-t-lg border md:border-0
                            ${
                                activeTab === tab.id
                                    ? 'bg-primary-red/20 border-primary-red text-pure-white shadow-[0_0_10px_rgba(218,41,28,0.2)] md:shadow-none md:bg-transparent md:border-b-2 md:text-pure-white'
                                    : 'bg-carbon-black/40 border-pure-white/10 text-highlight-silver hover:text-pure-white hover:bg-pure-white/5 md:bg-transparent md:border-transparent md:border-b-2'
                            }
                        `}
                    >
                        <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-primary-red' : 'text-current md:text-highlight-silver'}`}/> 
                        <span className={activeTab === tab.id ? 'text-pure-white' : ''}>{tab.label}</span>
                    </button>
                ))}
                </div>
            </div>
            
            <div className="min-h-[300px]">
                {activeTab === 'race' && <ResultTable title="Grand Prix Results" results={results.grandPrixFinish} allDrivers={allDrivers} allConstructors={allConstructors} />}
                {activeTab === 'quali' && <ResultTable title="Qualifying Results" results={results.gpQualifying} allDrivers={allDrivers} allConstructors={allConstructors} />}
                {activeTab === 'sprint' && event.hasSprint && <ResultTable title="Sprint Race Results" results={results.sprintFinish} allDrivers={allDrivers} allConstructors={allConstructors} />}
                {activeTab === 'fastestlap' && <FastestLapDisplay driverId={results.fastestLap} allDrivers={allDrivers} />}
            </div>
        </div>
    );
};

interface ResultTableProps {
    title: string;
    results: (string | null)[] | undefined;
    allDrivers: DriverType[];
    allConstructors: Constructor[];
}

const ResultTable: React.FC<ResultTableProps> = ({ title, results, allDrivers, allConstructors }) => {
    if (!results || results.length === 0 || results.every(r => r === null)) {
        return <p className="text-center text-highlight-silver py-12 italic">No data recorded for this session.</p>;
    }
    
    const getEntity = (driverId: string): { driver: DriverType | undefined, constructor: Constructor | undefined } => {
        const driver = allDrivers.find(d => d.id === driverId);
        const constructor = allConstructors.find(c => c.id === driver?.constructorId);
        return { driver, constructor };
    };

    return (
        <div className="overflow-x-auto rounded-xl border border-pure-white/10">
            <table className="w-full text-left min-w-full">
                <thead className="bg-carbon-black/60">
                    <tr>
                        <th className="p-4 text-xs font-bold uppercase text-highlight-silver text-center w-16">Pos</th>
                        <th className="p-4 text-xs font-bold uppercase text-highlight-silver">Driver</th>
                        <th className="p-4 text-xs font-bold uppercase text-highlight-silver hidden sm:table-cell">Team</th>
                    </tr>
                </thead>
                <tbody>
                    {results.map((driverId, index) => {
                        if (!driverId) return null;
                        const { driver, constructor } = getEntity(driverId);
                        const isPodium = index < 3;
                        
                        const TeamBadge = () => (
                            <span 
                                className="inline-block px-2 py-1 rounded text-[10px] md:text-xs font-bold uppercase tracking-wider border border-white/10"
                                style={{ 
                                    backgroundColor: `${constructor?.color || '#333'}33`, 
                                    color: constructor?.color || '#ccc', 
                                    borderColor: `${constructor?.color || '#333'}66` 
                                }}
                            >
                                {constructor?.name || 'Unknown Team'}
                            </span>
                        );

                        return (
                            <tr key={index} className={`border-t border-pure-white/5 ${index % 2 === 0 ? 'bg-pure-white/[0.02]' : ''} hover:bg-pure-white/10 transition-colors`}>
                                <td className="p-4 text-center">
                                    {isPodium ? (
                                        <span className={`inline-block w-8 h-8 leading-8 rounded-full font-bold ${
                                            index === 0 ? 'bg-yellow-500 text-black' : 
                                            index === 1 ? 'bg-gray-300 text-black' : 
                                            'bg-orange-700 text-white'
                                        }`}>
                                            {index + 1}
                                        </span>
                                    ) : (
                                        <span className="font-bold text-highlight-silver">{index + 1}</span>
                                    )}
                                </td>
                                <td className="p-4">
                                    <div className="font-bold text-lg text-pure-white">{driver?.name || 'Unknown Driver'}</div>
                                    <div className="sm:hidden mt-2">
                                        <TeamBadge />
                                    </div>
                                </td>
                                <td className="p-4 hidden sm:table-cell">
                                    <TeamBadge />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const FastestLapDisplay: React.FC<{ driverId: string | null | undefined; allDrivers: DriverType[] }> = ({ driverId, allDrivers }) => {
    if (!driverId) {
        return <p className="text-center text-highlight-silver py-12">Fastest lap data not available.</p>;
    }
    const driver = allDrivers.find(d => d.id === driverId);

    return (
        <div className="text-center py-16 bg-carbon-black/20 rounded-xl border border-pure-white/5">
            <h4 className="font-bold text-lg text-primary-red mb-4 uppercase tracking-widest">Fastest Lap Award</h4>
            <div className="inline-block p-6 rounded-full bg-purple-500/10 border border-purple-500/30 mb-6">
                 <FastestLapIcon className="w-16 h-16 text-purple-500" />
            </div>
            <p className="text-4xl font-bold text-pure-white">{driver?.name || 'Unknown Driver'}</p>
        </div>
    );
};

export default GpResultsPage;
