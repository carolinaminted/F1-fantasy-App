
import React, { useState, useMemo } from 'react';
import { RaceResults, Event, EventResult } from '../types.ts';
import { EVENTS, DRIVERS } from '../constants.ts';
import ResultsForm from './ResultsForm.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';

interface ResultsManagerPageProps {
    raceResults: RaceResults;
    onResultsUpdate: (eventId: string, results: EventResult) => Promise<void>;
    setAdminSubPage: (page: 'dashboard') => void;
}

type FilterType = 'all' | 'added' | 'pending';

const ResultsManagerPage: React.FC<ResultsManagerPageProps> = ({ raceResults, onResultsUpdate, setAdminSubPage }) => {
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');

    const handleSelectEvent = (eventId: string) => {
        setSelectedEventId(prevId => (prevId === eventId ? null : eventId));
    };

    const handleSave = async (eventId: string, results: EventResult): Promise<boolean> => {
        try {
            // Snapshot current driver-team mapping to ensure historical accuracy
            // This freezes the grid state at the time of the event
            const driverTeamsSnapshot: { [driverId: string]: string } = {};
            DRIVERS.forEach(d => {
                driverTeamsSnapshot[d.id] = d.constructorId;
            });

            const resultsWithSnapshot = {
                ...results,
                driverTeams: driverTeamsSnapshot
            };

            await onResultsUpdate(eventId, resultsWithSnapshot);
            // On desktop, keep the form open for potential further edits. On mobile, close it.
            if (window.innerWidth < 768) {
                setSelectedEventId(null);
            }
            return true;
        } catch (error) {
            alert(`Error: Could not update results for ${eventId}. Please check your connection and try again.`);
            return false;
        }
    };

    const checkHasResults = (event: Event): boolean => {
        const results = raceResults[event.id];
        if (!results) return false;
        // A more robust check for any piece of result data
        const hasGpFinish = results.grandPrixFinish?.some(pos => !!pos);
        const hasFastestLap = !!results.fastestLap;
        const hasSprintFinish = results.sprintFinish?.some(pos => !!pos);
        const hasGpQuali = results.gpQualifying?.some(pos => !!pos);
        const hasSprintQuali = results.sprintQualifying?.some(pos => !!pos);
        return hasGpFinish || hasFastestLap || hasSprintFinish || hasGpQuali || hasSprintQuali;
    };

    const filteredEvents = useMemo(() => {
        return EVENTS.filter(event => {
            const hasResults = checkHasResults(event);
            if (filter === 'all') return true;
            if (filter === 'added') return hasResults;
            if (filter === 'pending') return !hasResults;
            return true;
        });
    }, [filter, raceResults]);

    const selectedEvent = useMemo(() => EVENTS.find(event => event.id === selectedEventId), [selectedEventId]);

    const FilterButton: React.FC<{label: string, value: FilterType, current: FilterType, onClick: (val: FilterType) => void}> = ({ label, value, current, onClick }) => {
        const isActive = value === current;
        return (
            <button
                onClick={() => onClick(value)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors w-full ${
                    isActive
                        ? 'bg-primary-red text-pure-white'
                        : 'bg-carbon-black/50 text-highlight-silver hover:bg-accent-gray'
                }`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="max-w-7xl mx-auto text-pure-white">
            <div className="flex items-center justify-between mb-8">
                 <button 
                    onClick={() => setAdminSubPage('dashboard')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                >
                    <BackIcon className="w-5 h-5" />
                    Back
                </button>
                <h1 className="text-3xl font-bold flex items-center gap-3 text-right">
                    Results Manager <AdminIcon className="w-8 h-8"/>
                </h1>
            </div>
            
            <div className="flex flex-col md:flex-row md:gap-8">
                {/* Event List (Left Column on Desktop) */}
                <div className="w-full md:w-2/5 lg:w-1/3">
                    <div className="flex items-center justify-center gap-2 mb-6 p-2 rounded-lg bg-accent-gray/50 w-fit mx-auto md:w-full">
                        <FilterButton label="Show All" value="all" current={filter} onClick={setFilter} />
                        <FilterButton label="Results Added" value="added" current={filter} onClick={setFilter} />
                        <FilterButton label="Needs Results" value="pending" current={filter} onClick={setFilter} />
                    </div>
                    <div className="space-y-2">
                        {filteredEvents.map(event => {
                            const isSelected = selectedEventId === event.id;
                            const hasResults = checkHasResults(event);
                            return (
                                <div key={event.id} className={`bg-accent-gray/50 backdrop-blur-sm rounded-lg overflow-hidden transition-all duration-300 ${isSelected ? 'ring-2 ring-primary-red' : 'ring-1 ring-pure-white/10'}`}>
                                    <div 
                                        className="p-4 flex justify-between items-center cursor-pointer hover:bg-accent-gray/70"
                                        onClick={() => handleSelectEvent(event.id)}
                                    >
                                        <div>
                                            <h2 className={`text-lg font-bold ${isSelected ? 'text-primary-red' : ''}`}>R{event.round}: {event.name}</h2>
                                            <p className="text-sm text-highlight-silver">{event.country}</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {hasResults && <span className="hidden sm:block text-xs font-bold uppercase tracking-wider bg-highlight-silver/20 text-ghost-white px-3 py-1 rounded-full">Results Added</span>}
                                            <div className="md:hidden bg-primary-red text-pure-white font-bold py-2 px-4 rounded-lg text-sm">
                                                {isSelected ? 'Close' : 'Manage'}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Mobile expanded view */}
                                    {isSelected && (
                                        <div className="md:hidden p-4 border-t border-accent-gray">
                                            <ResultsForm
                                                event={event}
                                                currentResults={raceResults[event.id]}
                                                onSave={handleSave}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {filteredEvents.length === 0 && (
                            <div className="text-center py-12 bg-accent-gray/30 rounded-lg">
                                <p className="text-highlight-silver">No events match the current filter.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Form Display (Right Column on Desktop) */}
                <div className="hidden md:block w-full md:w-3/5 lg:w-2/3">
                    <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10 sticky top-8">
                        {selectedEvent ? (
                            <div>
                                <h2 className="text-2xl font-bold mb-4">Manage Results: {selectedEvent.name}</h2>
                                <ResultsForm
                                    event={selectedEvent}
                                    currentResults={raceResults[selectedEvent.id]}
                                    onSave={handleSave}
                                />
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-96">
                                <p className="text-highlight-silver text-lg">Select an event from the list to manage results.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResultsManagerPage;
