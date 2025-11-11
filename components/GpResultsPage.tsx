
import React, { useState, useMemo } from 'react';
import { RaceResults, Event, EventResult, Driver as DriverType, Constructor } from '../types.ts';
import { EVENTS, DRIVERS, CONSTRUCTORS } from '../constants.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';

interface GpResultsPageProps {
  raceResults: RaceResults;
}

const GpResultsPage: React.FC<GpResultsPageProps> = ({ raceResults }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

    const filteredEvents = useMemo(() => {
        if (!searchTerm.trim()) {
            return EVENTS;
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return EVENTS.filter(event =>
            event.name.toLowerCase().includes(lowercasedTerm) ||
            event.country.toLowerCase().includes(lowercasedTerm)
        );
    }, [searchTerm]);

    const toggleEvent = (eventId: string) => {
        setExpandedEventId(prev => (prev === eventId ? null : eventId));
    };

    return (
        <div className="max-w-7xl mx-auto text-pure-white">
            <h1 className="text-3xl md:text-4xl font-bold text-pure-white mb-2 text-center">Grand Prix Results</h1>
            <p className="text-center text-highlight-silver mb-8">Browse official results for the season.</p>
            
            <div className="mb-6 sticky top-0 z-10 bg-carbon-black/80 backdrop-blur-md py-4 -mx-4 px-4 md:relative md:bg-transparent md:backdrop-blur-none md:p-0 md:m-0">
                <input
                    type="text"
                    aria-label="Search for an event"
                    placeholder="Search by event name or country..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-carbon-black/70 border border-accent-gray rounded-md shadow-sm py-3 px-4 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
                />
            </div>
            
            <div className="space-y-2">
                {filteredEvents.map(event => (
                    <EventItem
                        key={event.id}
                        event={event}
                        results={raceResults[event.id]}
                        isExpanded={expandedEventId === event.id}
                        onToggle={() => toggleEvent(event.id)}
                    />
                ))}
                {filteredEvents.length === 0 && (
                    <div className="text-center py-12 bg-accent-gray/30 rounded-lg">
                        <p className="text-highlight-silver">No events match your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Sub-components for GpResultsPage ---

interface EventItemProps {
    event: Event;
    results: EventResult | undefined;
    isExpanded: boolean;
    onToggle: () => void;
}

const EventItem: React.FC<EventItemProps> = ({ event, results, isExpanded, onToggle }) => {
    const hasResults = !!results && results.grandPrixFinish?.some(r => r);

    return (
        <div className="rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
            <button 
                className="w-full p-4 flex justify-between items-center cursor-pointer text-left hover:bg-pure-white/5 transition-colors"
                onClick={onToggle}
                aria-expanded={isExpanded}
            >
                <div>
                    <h3 className="font-bold text-lg">R{event.round}: {event.name}</h3>
                    <p className="text-sm text-highlight-silver">{event.country}</p>
                </div>
                <div className="flex items-center gap-4">
                    {hasResults ? (
                        <span className="text-xs font-bold uppercase tracking-wider bg-highlight-silver/20 text-ghost-white px-3 py-1 rounded-full hidden sm:block">Results In</span>
                    ) : (
                         <span className="text-xs font-bold uppercase tracking-wider bg-carbon-black/50 text-highlight-silver px-3 py-1 rounded-full hidden sm:block">Pending</span>
                    )}
                    <ChevronDownIcon className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            {isExpanded && (
                <div className="p-4 border-t border-accent-gray/50">
                    <EventDetails event={event} results={results} />
                </div>
            )}
        </div>
    );
};

interface EventDetailsProps {
    event: Event;
    results: EventResult | undefined;
}

const EventDetails: React.FC<EventDetailsProps> = ({ event, results }) => {
    const [activeTab, setActiveTab] = useState('race');

    if (!results || !results.grandPrixFinish?.some(r => r)) {
        return <p className="text-center text-highlight-silver py-8">Results for this event are not yet available.</p>;
    }

    const tabs = [
        { id: 'race', label: 'Race', icon: CheckeredFlagIcon },
        { id: 'quali', label: 'Qualifying', icon: PolePositionIcon },
        ...(event.hasSprint ? [{ id: 'sprint', label: 'Sprint', icon: SprintIcon }] : []),
        { id: 'fastestlap', label: 'Fastest Lap', icon: FastestLapIcon },
    ];
    
    return (
        <div>
            <div className="flex items-center justify-center border-b border-accent-gray/50 mb-4 overflow-x-auto">
                {tabs.map(tab => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors border-b-2 ${
                            activeTab === tab.id
                                ? 'border-primary-red text-pure-white'
                                : 'border-transparent text-highlight-silver hover:text-pure-white'
                        }`}
                    >
                        <tab.icon className="w-5 h-5"/> {tab.label}
                    </button>
                ))}
            </div>
            
            <div>
                {activeTab === 'race' && <ResultTable title="Grand Prix Results" results={results.grandPrixFinish} />}
                {activeTab === 'quali' && <ResultTable title="Qualifying Results" results={results.gpQualifying} />}
                {activeTab === 'sprint' && event.hasSprint && <ResultTable title="Sprint Race Results" results={results.sprintFinish} />}
                {activeTab === 'fastestlap' && <FastestLapDisplay driverId={results.fastestLap} />}
            </div>
        </div>
    );
};

interface ResultTableProps {
    title: string;
    results: (string | null)[] | undefined;
}

const ResultTable: React.FC<ResultTableProps> = ({ title, results }) => {
    if (!results || results.length === 0) {
        return <p className="text-center text-highlight-silver py-4">No data for this session.</p>;
    }
    
    const getEntity = (driverId: string): { driver: DriverType | undefined, constructor: Constructor | undefined } => {
        const driver = DRIVERS.find(d => d.id === driverId);
        const constructor = CONSTRUCTORS.find(c => c.id === driver?.constructorId);
        return { driver, constructor };
    };

    return (
        <div className="overflow-x-auto">
            <h4 className="font-bold text-lg text-primary-red mb-3 text-center">{title}</h4>
            <table className="w-full text-left min-w-full">
                <thead className="bg-carbon-black/50">
                    <tr>
                        <th className="p-2 text-sm font-semibold uppercase text-highlight-silver text-center w-12">Pos</th>
                        <th className="p-2 text-sm font-semibold uppercase text-highlight-silver">Driver</th>
                        <th className="p-2 text-sm font-semibold uppercase text-highlight-silver hidden sm:table-cell">Team</th>
                    </tr>
                </thead>
                <tbody>
                    {results.map((driverId, index) => {
                        if (!driverId) return null;
                        const { driver, constructor } = getEntity(driverId);
                        return (
                            <tr key={index} className="border-t border-accent-gray/50">
                                <td className="p-2 font-bold text-center">{index + 1}</td>
                                <td className="p-2 font-semibold">
                                    {driver?.name || 'Unknown Driver'}
                                    <div className="sm:hidden text-xs text-highlight-silver">{constructor?.name || 'Unknown Team'}</div>
                                </td>
                                <td className="p-2 text-highlight-silver hidden sm:table-cell">{constructor?.name || 'Unknown Team'}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const FastestLapDisplay: React.FC<{ driverId: string | null | undefined }> = ({ driverId }) => {
    if (!driverId) {
        return <p className="text-center text-highlight-silver py-4">Fastest lap data not available.</p>;
    }
    const driver = DRIVERS.find(d => d.id === driverId);

    return (
        <div className="text-center py-8">
            <h4 className="font-bold text-lg text-primary-red mb-2">Fastest Lap</h4>
            <p className="text-3xl font-bold text-pure-white">{driver?.name || 'Unknown Driver'}</p>
        </div>
    );
};


export default GpResultsPage;
