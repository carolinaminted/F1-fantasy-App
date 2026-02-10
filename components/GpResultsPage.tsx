
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RaceResults, Event, EventResult, Driver as DriverType, Constructor } from '../types.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { EventSelector } from './ui/EventSelector.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { Page } from '../App.tsx';

interface GpResultsPageProps {
  raceResults: RaceResults;
  allDrivers: DriverType[];
  allConstructors: Constructor[];
  events: Event[];
  setActivePage: (page: Page) => void;
}

const GpResultsPage: React.FC<GpResultsPageProps> = ({ raceResults, allDrivers, allConstructors, events, setActivePage }) => {
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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
            } else {
                // Or just the first event if season hasn't started or no results
                setSelectedEventId(events[0].id);
            }
        }
    }, [events, raceResults]);

    // Helper to check status
    const hasResults = (eventId: string) => {
        const r = raceResults[eventId];
        if (!r) return false;
        return (
            r.grandPrixFinish?.some(pos => !!pos) || 
            !!r.fastestLap ||
            r.sprintFinish?.some(pos => !!pos) ||
            r.gpQualifying?.some(pos => !!pos) ||
            r.sprintQualifying?.some(pos => !!pos)
        );
    };

    const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [selectedEventId, events]);

    const eventDate = useMemo(() => {
        if (!selectedEvent?.lockAtUtc) return null;
        try {
            const date = new Date(selectedEvent.lockAtUtc);
            if (isNaN(date.getTime())) return null;
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                timeZone: 'America/New_York'
            });
        } catch (e) {
            return null;
        }
    }, [selectedEvent]);

    const handleEventFilter = (event: Event, filter: string) => {
        const resultsIn = hasResults(event.id);
        if (filter === 'results') return resultsIn;
        if (filter === 'pending') return !resultsIn;
        return true;
    };

    const renderEventStatus = (event: Event) => {
        const resultsIn = hasResults(event.id);
        return resultsIn ? (
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
        ) : null;
    };

    const hubAction = (
        <button 
            onClick={() => setActivePage('league-hub')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">League Hub</span>
        </button>
    );

    return (
        <div className="flex flex-col md:h-full md:overflow-hidden w-full max-w-7xl mx-auto pb-10 md:pb-safe">
            <div className="flex-none">
                <PageHeader 
                    title="RACE RESULTS" 
                    icon={CheckeredFlagIcon} 
                    leftAction={hubAction}
                    rightAction={
                        <EventSelector 
                            events={events}
                            selectedEventId={selectedEventId}
                            onSelect={(e) => setSelectedEventId(e.id)}
                            filters={[
                                { label: 'All', value: 'all' },
                                { label: 'Results', value: 'results' },
                                { label: 'Pending', value: 'pending' }
                            ]}
                            filterPredicate={handleEventFilter}
                            renderStatus={renderEventStatus}
                            placeholder="Select Grand Prix..."
                        />
                    }
                />
            </div>
            
            {/* Main Content Card - Fills remaining space */}
            <div className="flex-1 md:min-h-0 flex flex-col bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-xl md:overflow-hidden relative mb-12 md:mb-8">
                {selectedEvent ? (
                    <div className="flex flex-col h-full">
                        {/* Event Header Panel */}
                        <div className="flex-none px-4 py-3 border-b border-pure-white/10 bg-gradient-to-r from-carbon-black/80 to-carbon-black/40 flex flex-row justify-between items-center gap-2">
                            <div>
                                <div className="flex items-baseline gap-3">
                                    <h2 className="text-xl md:text-2xl font-black text-pure-white leading-tight">{selectedEvent.name}</h2>
                                    {eventDate && (
                                        <span className="text-sm md:text-base font-bold text-highlight-silver/50 uppercase tracking-widest">
                                            {eventDate}
                                        </span>
                                    )}
                                </div>
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
                        <div className="flex-1 md:min-h-0 md:overflow-hidden relative">
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
        ...(event.hasSprint ? [
            { id: 'sprint', label: 'Sprint', icon: SprintIcon },
            { id: 'sprintQuali', label: 'Sprint Quali', icon: PolePositionIcon }
        ] : []),
        { id: 'fastestlap', label: 'Fastest Lap', icon: FastestLapIcon },
    ];
    
    return (
        <div className="flex flex-col md:h-full">
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
            <div className="md:flex-1 md:overflow-y-auto custom-scrollbar p-0 bg-black/10 pb-20 md:pb-0">
                {activeTab === 'race' && <ResultTable results={results.grandPrixFinish} allDrivers={allDrivers} allConstructors={allConstructors} />}
                {activeTab === 'quali' && <ResultTable results={results.gpQualifying} allDrivers={allDrivers} allConstructors={allConstructors} />}
                {activeTab === 'sprint' && event.hasSprint && <ResultTable results={results.sprintFinish} allDrivers={allDrivers} allConstructors={allConstructors} />}
                {activeTab === 'sprintQuali' && event.hasSprint && <ResultTable results={results.sprintQualifying} allDrivers={allDrivers} allConstructors={allConstructors} />}
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