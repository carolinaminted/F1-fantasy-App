
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RaceResults, Event, EventResult, Driver as DriverType, Constructor } from '../types.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';

interface GpResultsPageProps {
  raceResults: RaceResults;
  allDrivers: DriverType[];
  allConstructors: Constructor[];
  events: Event[];
}

const GpResultsPage: React.FC<GpResultsPageProps> = ({ raceResults, allDrivers, allConstructors, events }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'results' | 'pending'>('all');
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Auto-select the last completed event on load if none selected
    useEffect(() => {
        if (!selectedEventId && events.length > 0) {
            // Find last event with results
            const completedEvents = events.filter(e => {
                const r = raceResults[e.id];
                return r && (r.grandPrixFinish?.some(p => !!p) || !!r.fastestLap);
            });
            
            if (completedEvents.length > 0) {
                // Select the last one (most recent)
                const lastCompleted = completedEvents[completedEvents.length - 1];
                setSelectedEventId(lastCompleted.id);
                setSearchTerm(lastCompleted.name);
            } else {
                // Or just the first event if season hasn't started or no results
                setSelectedEventId(events[0].id);
                setSearchTerm(events[0].name);
            }
        }
    }, [events, raceResults]);

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
        if (!r) return false;
        return (
            r.grandPrixFinish?.some(pos => !!pos) || 
            !!r.fastestLap ||
            r.sprintFinish?.some(pos => !!pos) ||
            r.gpQualifying?.some(pos => !!pos)
        );
    };

    const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [selectedEventId, events]);

    const filteredEvents = useMemo(() => {
        const isExactMatch = selectedEvent && searchTerm === selectedEvent.name;
        const effectiveSearch = isExactMatch ? '' : searchTerm.toLowerCase();

        return events.filter(event => {
            const resultsIn = hasResults(event.id);
            if (filterStatus === 'results' && !resultsIn) return false;
            if (filterStatus === 'pending' && resultsIn) return false;

            if (!effectiveSearch) return true;
            return (
                event.name.toLowerCase().includes(effectiveSearch) ||
                event.country.toLowerCase().includes(effectiveSearch) ||
                event.round.toString().includes(effectiveSearch) ||
                event.location.toLowerCase().includes(effectiveSearch)
            );
        });
    }, [searchTerm, filterStatus, selectedEvent, raceResults, events]);

    const handleEventSelect = (event: Event) => {
        setSelectedEventId(event.id);
        setSearchTerm(event.name);
        setIsDropdownOpen(false);
    };

    const FilterButton: React.FC<{ label: string; value: typeof filterStatus }> = ({ label, value }) => (
        <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFilterStatus(value); }}
            className={`flex-1 px-2 py-1 text-[10px] font-bold rounded-lg transition-colors border ${
                filterStatus === value
                ? 'bg-primary-red text-pure-white border-primary-red'
                : 'bg-carbon-black text-highlight-silver border-pure-white/10 hover:border-highlight-silver hover:text-pure-white'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full w-full max-w-7xl mx-auto md:h-[calc(100vh-6rem)] md:overflow-hidden pb-safe">
            {/* Header & Controls Bar */}
            <div className="flex-none relative mb-4 pt-2 md:pt-0">
                <h1 className="text-2xl md:text-3xl font-bold text-pure-white flex items-center justify-center gap-3 mb-4 md:mb-0 text-center w-full">
                    <CheckeredFlagIcon className="w-8 h-8 text-primary-red" />
                    Grand Prix Results
                </h1>
                
                {/* Search / Dropdown Bar - Absolute Right on Desktop */}
                <div className="relative w-full md:w-72 z-40 md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2" ref={dropdownRef}>
                    <div className="relative group">
                        <input
                            type="text"
                            aria-label="Select Event"
                            placeholder="Select Grand Prix..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); }}
                            onFocus={(e) => { setIsDropdownOpen(true); e.target.select(); }}
                            className="w-full bg-carbon-black border border-accent-gray rounded-lg shadow-sm py-1.5 pl-3 pr-8 text-pure-white font-semibold focus:outline-none focus:ring-1 focus:ring-primary-red focus:border-transparent transition-all text-sm h-9"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-highlight-silver group-focus-within:text-primary-red transition-colors">
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>
                    </div>

                    {isDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-accent-gray border border-pure-white/10 rounded-xl shadow-2xl max-h-80 overflow-hidden flex flex-col animate-fade-in-down">
                            <div className="flex-shrink-0 p-2 bg-carbon-black/95 border-b border-pure-white/10 grid grid-cols-3 gap-2 backdrop-blur-sm sticky top-0 z-50">
                                <FilterButton label="All" value="all" />
                                <FilterButton label="Results" value="results" />
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
                                                className={`w-full text-left px-3 py-2 border-b border-pure-white/5 last:border-0 hover:bg-pure-white/5 transition-colors flex items-center justify-between group ${selectedEventId === event.id ? 'bg-pure-white/10' : ''}`}
                                            >
                                                <div>
                                                    <div className="font-bold text-pure-white text-xs">R{event.round}: {event.name}</div>
                                                    <div className="text-[10px] text-highlight-silver">{event.location}</div>
                                                </div>
                                                {resultsIn && (
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
                                                )}
                                            </button>
                                        );
                                    })
                                ) : (
                                    <div className="p-3 text-center text-highlight-silver text-xs">
                                        No events found.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Main Content Card - Fills remaining space */}
            <div className="flex-1 min-h-0 flex flex-col bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-xl overflow-hidden relative">
                {selectedEvent ? (
                    <div className="flex flex-col h-full">
                        {/* Event Header Panel */}
                        <div className="flex-none px-4 py-3 border-b border-pure-white/10 bg-gradient-to-r from-carbon-black/80 to-carbon-black/40 flex flex-row justify-between items-center gap-2">
                            <div>
                                <h2 className="text-xl md:text-2xl font-black text-pure-white leading-tight">{selectedEvent.name}</h2>
                                <p className="text-xs text-highlight-silver flex items-center gap-2 mt-0.5">
                                    <span className="bg-pure-white/10 text-pure-white px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Round {selectedEvent.round}</span>
                                    {selectedEvent.country}
                                </p>
                            </div>
                            <div>
                                {hasResults(selectedEvent.id) ? (
                                     <div className="flex items-center gap-1.5 text-green-400 bg-green-400/10 px-2 py-1 rounded-lg border border-green-400/20 shadow-[0_0_10px_rgba(74,222,128,0.1)]">
                                        <CheckeredFlagIcon className="w-3 h-3" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Results In</span>
                                     </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 text-highlight-silver/70 bg-pure-white/5 px-2 py-1 rounded-lg border border-pure-white/10">
                                        <span className="text-[10px] font-bold uppercase tracking-wider">Pending</span>
                                     </div>
                                )}
                            </div>
                        </div>

                        {/* Details Component - Takes remaining space */}
                        <div className="flex-1 min-h-0 overflow-hidden relative">
                            <EventDetails 
                                event={selectedEvent} 
                                results={raceResults[selectedEvent.id]} 
                                allDrivers={allDrivers} 
                                allConstructors={allConstructors} 
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full opacity-30">
                        <CheckeredFlagIcon className="w-20 h-20 text-highlight-silver mb-3" />
                        <p className="text-lg font-bold text-highlight-silver">Select an event</p>
                    </div>
                )}
            </div>
        </div>
    );
};

interface EventDetailsProps {
    event: Event;
    results: EventResult | undefined;
    allDrivers: DriverType[];
    allConstructors: Constructor[];
}

const EventDetails: React.FC<EventDetailsProps> = ({ event, results, allDrivers, allConstructors }) => {
    const [activeTab, setActiveTab] = useState('race');

    if (!results || (!results.grandPrixFinish?.some(r => r) && !results.fastestLap)) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-lg text-highlight-silver mb-1 font-bold">Results Pending</p>
                <p className="text-sm text-highlight-silver/50">Data for this session has not been published yet.</p>
            </div>
        );
    }

    const tabs = [
        { id: 'race', label: 'Race', icon: CheckeredFlagIcon },
        { id: 'quali', label: 'Quali', icon: PolePositionIcon },
        ...(event.hasSprint ? [{ id: 'sprint', label: 'Sprint', icon: SprintIcon }] : []),
        { id: 'fastestlap', label: 'Fastest Lap', icon: FastestLapIcon },
    ];
    
    return (
        <div className="flex flex-col h-full">
            {/* Tabs Bar */}
            <div className="flex-none bg-carbon-black/20 border-b border-pure-white/5 px-2 flex gap-1 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-2 px-3 py-2.5 text-xs font-bold transition-all relative whitespace-nowrap
                            ${
                                activeTab === tab.id
                                    ? 'text-pure-white'
                                    : 'text-highlight-silver hover:text-pure-white opacity-70 hover:opacity-100'
                            }
                        `}
                    >
                        <tab.icon className={`w-3.5 h-3.5 ${activeTab === tab.id ? 'text-primary-red' : 'text-current'}`}/> 
                        <span>{tab.label}</span>
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-red shadow-[0_0_8px_rgba(218,41,28,0.8)]"></div>
                        )}
                    </button>
                ))}
            </div>
            
            {/* Content Area - Scrollable Table */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-black/10">
                {activeTab === 'race' && <ResultTable results={results.grandPrixFinish} allDrivers={allDrivers} allConstructors={allConstructors} />}
                {activeTab === 'quali' && <ResultTable results={results.gpQualifying} allDrivers={allDrivers} allConstructors={allConstructors} />}
                {activeTab === 'sprint' && event.hasSprint && <ResultTable results={results.sprintFinish} allDrivers={allDrivers} allConstructors={allConstructors} />}
                {activeTab === 'fastestlap' && <FastestLapDisplay driverId={results.fastestLap} allDrivers={allDrivers} allConstructors={allConstructors} />}
            </div>
        </div>
    );
};

interface ResultTableProps {
    results: (string | null)[] | undefined;
    allDrivers: DriverType[];
    allConstructors: Constructor[];
}

const ResultTable: React.FC<ResultTableProps> = ({ results, allDrivers, allConstructors }) => {
    if (!results || results.length === 0 || results.every(r => r === null)) {
        return (
            <div className="flex flex-col items-center justify-center h-40 text-highlight-silver italic text-sm">
                No data available.
            </div>
        );
    }
    
    const getEntity = (driverId: string): { driver: DriverType | undefined, constructor: Constructor | undefined } => {
        const driver = allDrivers.find(d => d.id === driverId);
        const constructor = allConstructors.find(c => c.id === driver?.constructorId);
        return { driver, constructor };
    };

    return (
        <table className="w-full text-left border-collapse">
            <thead className="bg-carbon-black/95 sticky top-0 z-10 backdrop-blur-md shadow-sm text-xs font-bold uppercase text-highlight-silver">
                <tr>
                    <th className="py-3 px-4 w-12 text-center">Pos</th>
                    <th className="py-3 px-4">Driver</th>
                    <th className="py-3 px-4 hidden sm:table-cell">Team</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-pure-white/5">
                {results.map((driverId, index) => {
                    if (!driverId) return null;
                    const { driver, constructor } = getEntity(driverId);
                    
                    return (
                        <tr key={index} className="hover:bg-pure-white/5 transition-colors group">
                            <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs ${
                                    index === 0 ? 'bg-yellow-500 text-black shadow-yellow-500/20' : 
                                    index === 1 ? 'bg-gray-300 text-black' : 
                                    index === 2 ? 'bg-orange-700 text-white' : 
                                    'text-highlight-silver group-hover:text-pure-white'
                                }`}>
                                    {index + 1}
                                </span>
                            </td>
                            <td className="py-3 px-4">
                                <div className="font-bold text-base md:text-lg text-pure-white">{driver?.name || 'Unknown Driver'}</div>
                                {/* Mobile Team Name */}
                                <div className="sm:hidden text-[10px] text-highlight-silver uppercase tracking-wider mt-0.5" style={{ color: constructor?.color }}>
                                    {constructor?.name || 'Unknown Team'}
                                </div>
                            </td>
                            <td className="py-3 px-4 hidden sm:table-cell">
                                {constructor && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 rounded-full" style={{ backgroundColor: constructor.color }}></div>
                                        <span className="text-sm font-semibold text-highlight-silver">{constructor.name}</span>
                                    </div>
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
};

const FastestLapDisplay: React.FC<{ driverId: string | null | undefined; allDrivers: DriverType[]; allConstructors: Constructor[] }> = ({ driverId, allDrivers, allConstructors }) => {
    if (!driverId) {
        return <div className="flex items-center justify-center h-48 text-highlight-silver italic text-sm">Fastest lap not recorded.</div>;
    }
    const driver = allDrivers.find(d => d.id === driverId);
    const constructor = allConstructors.find(c => c.id === driver?.constructorId);

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-gradient-to-b from-purple-900/10 to-transparent">
            <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mb-4 ring-1 ring-purple-500/50 shadow-[0_0_30px_rgba(168,85,247,0.15)] animate-pulse-slow">
                 <FastestLapIcon className="w-10 h-10 text-purple-400" />
            </div>
            
            <h3 className="text-sm font-bold text-highlight-silver uppercase tracking-widest mb-2">Fastest Lap Award</h3>
            <p className="text-3xl md:text-4xl font-black text-pure-white mb-4">{driver?.name || 'Unknown'}</p>
            
            {constructor && (
                <div 
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-pure-white/10 bg-carbon-black/50"
                    style={{ borderColor: `${constructor.color}40` }}
                >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: constructor.color }}></div>
                    <span className="text-sm font-bold uppercase tracking-wider" style={{ color: constructor.color }}>{constructor.name}</span>
                </div>
            )}
        </div>
    );
};

export default GpResultsPage;
