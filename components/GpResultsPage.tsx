
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
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

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

    const handleEventSelect = (eventId: string) => {
        setSelectedEventId(prev => (prev === eventId ? null : eventId));
    };
    
    const selectedEvent = useMemo(() => EVENTS.find(e => e.id === selectedEventId), [selectedEventId]);

    return (
        <div className="max-w-7xl mx-auto text-pure-white">
            <h1 className="text-3xl md:text-4xl font-bold text-pure-white mb-2 text-center">Grand Prix Results</h1>
            <p className="text-center text-highlight-silver mb-6">Browse official results for the season.</p>
            
            <IconLegend />

            <div className="mb-6">
                <input
                    type="text"
                    aria-label="Search for an event"
                    placeholder="Search by event name or country..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-carbon-black/70 border border-accent-gray rounded-md shadow-sm py-3 px-4 text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red"
                />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 md:gap-8">
                {/* Master List (Left Column on Desktop) */}
                <div className="space-y-2 md:col-span-2">
                    {filteredEvents.map(event => (
                        <EventItem
                            key={event.id}
                            event={event}
                            results={raceResults[event.id]}
                            isExpanded={selectedEventId === event.id}
                            isSelected={selectedEventId === event.id}
                            onSelect={() => handleEventSelect(event.id)}
                        />
                    ))}
                    {filteredEvents.length === 0 && (
                        <div className="text-center py-12 bg-accent-gray/30 rounded-lg">
                            <p className="text-highlight-silver">No events match your search.</p>
                        </div>
                    )}
                </div>

                {/* Detail Pane (Right Column on Desktop) */}
                <div className="hidden md:block md:col-span-3">
                    <div className="sticky top-8">
                        {selectedEvent ? (
                             <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 p-4">
                                <EventDetails event={selectedEvent} results={raceResults[selectedEvent.id]} />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-96 bg-accent-gray/20 rounded-lg">
                                <p className="text-highlight-silver text-lg">Select an event to view results.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Sub-components for GpResultsPage ---

const IconLegend: React.FC = () => (
    <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-2 text-xs text-highlight-silver mb-6 md:hidden">
        <div className="flex items-center gap-1.5"><CheckeredFlagIcon className="w-4 h-4" /> Race</div>
        <div className="flex items-center gap-1.5"><PolePositionIcon className="w-4 h-4" /> Quali</div>
        <div className="flex items-center gap-1.5"><SprintIcon className="w-4 h-4" /> Sprint</div>
        <div className="flex items-center gap-1.5"><FastestLapIcon className="w-4 h-4" /> Fastest Lap</div>
    </div>
);

interface EventItemProps {
    event: Event;
    results: EventResult | undefined;
    isExpanded: boolean;
    isSelected: boolean;
    onSelect: () => void;
}

const EventItem: React.FC<EventItemProps> = ({ event, results, isExpanded, isSelected, onSelect }) => {
    const hasResults = !!results && results.grandPrixFinish?.some(r => r);

    return (
        <div className={`rounded-lg overflow-hidden transition-all duration-300 ${isSelected ? 'ring-2 ring-primary-red' : 'ring-1 ring-pure-white/10'}`}>
            <button 
                className="w-full p-4 flex justify-between items-center cursor-pointer text-left hover:bg-pure-white/5 transition-colors"
                onClick={onSelect}
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
                    <ChevronDownIcon className={`w-6 h-6 transition-transform md:hidden ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
            </button>
            {isExpanded && (
                <div className="p-4 border-t border-accent-gray/50 md:hidden">
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
            <div className="flex items-center justify-around md:justify-center border-b border-accent-gray/50 mb-4">
                {tabs.map(tab => (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        aria-label={tab.label}
                        className={`flex items-center gap-2 px-3 md:px-4 py-2 text-sm font-semibold transition-colors border-b-2 whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'border-primary-red text-pure-white'
                                : 'border-transparent text-highlight-silver hover:text-pure-white'
                        }`}
                    >
                        <tab.icon className="w-5 h-5"/> <span className="hidden md:inline">{tab.label}</span>
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
    if (!results || results.length === 0 || results.every(r => r === null)) {
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
