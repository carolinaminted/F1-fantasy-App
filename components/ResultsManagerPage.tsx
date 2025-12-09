
import React, { useState, useMemo, useEffect } from 'react';
import { RaceResults, Event, EventResult, Driver } from '../types.ts';
import { EVENTS } from '../constants.ts';
import ResultsForm from './ResultsForm.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';

interface ResultsManagerPageProps {
    raceResults: RaceResults;
    onResultsUpdate: (eventId: string, results: EventResult) => Promise<void>;
    setAdminSubPage: (page: 'dashboard') => void;
    allDrivers: Driver[];
    formLocks: { [eventId: string]: boolean };
    onToggleLock: (eventId: string) => void;
}

type FilterType = 'all' | 'added' | 'pending';

const ResultsManagerPage: React.FC<ResultsManagerPageProps> = ({ raceResults, onResultsUpdate, setAdminSubPage, allDrivers, formLocks, onToggleLock }) => {
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [filter, setFilter] = useState<FilterType>('all');

    const checkHasResults = (event: Event): boolean => {
        const results = raceResults[event.id];
        if (!results) return false;
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

    // Auto-select first event if current selection is invalid after filter change
    useEffect(() => {
        if (selectedEventId && !filteredEvents.find(e => e.id === selectedEventId)) {
            setSelectedEventId('');
        }
    }, [filter, filteredEvents, selectedEventId]);

    const handleSave = async (eventId: string, results: EventResult): Promise<boolean> => {
        try {
            const driverTeamsSnapshot: { [driverId: string]: string } = {};
            allDrivers.forEach(d => {
                driverTeamsSnapshot[d.id] = d.constructorId;
            });

            const resultsWithSnapshot = {
                ...results,
                driverTeams: driverTeamsSnapshot
            };

            await onResultsUpdate(eventId, resultsWithSnapshot);
            return true;
        } catch (error) {
            alert(`Error: Could not update results for ${eventId}. Please check your connection and try again.`);
            return false;
        }
    };

    const selectedEvent = useMemo(() => EVENTS.find(event => event.id === selectedEventId), [selectedEventId]);

    const FilterButton: React.FC<{label: string, value: FilterType, current: FilterType, onClick: (val: FilterType) => void}> = ({ label, value, current, onClick }) => {
        const isActive = value === current;
        return (
            <button
                onClick={() => onClick(value)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex-1 md:flex-none ${
                    isActive
                        ? 'bg-primary-red text-pure-white'
                        : 'bg-carbon-black text-highlight-silver hover:bg-carbon-black/80'
                }`}
            >
                {label}
            </button>
        );
    };

    return (
        <div className="max-w-7xl mx-auto text-pure-white min-h-[calc(100vh-100px)]">
            <div className="flex items-center justify-between mb-6">
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
            
            {/* Control Bar: Filters & Dropdown */}
            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-4 mb-8 ring-1 ring-pure-white/10 flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Filters */}
                <div className="flex gap-2 w-full md:w-auto p-1 bg-accent-gray/50 rounded-lg">
                    <FilterButton label="All" value="all" current={filter} onClick={setFilter} />
                    <FilterButton label="Done" value="added" current={filter} onClick={setFilter} />
                    <FilterButton label="Todo" value="pending" current={filter} onClick={setFilter} />
                </div>

                {/* Event Selector */}
                <div className="relative w-full md:w-96">
                    <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="w-full appearance-none bg-carbon-black border border-accent-gray rounded-lg py-3 pl-4 pr-10 text-pure-white font-semibold focus:outline-none focus:ring-2 focus:ring-primary-red cursor-pointer"
                    >
                        <option value="" disabled>Select an event to manage...</option>
                        {filteredEvents.map(event => {
                            const isLocked = formLocks[event.id];
                            const hasResults = checkHasResults(event);
                            const statusMarker = hasResults ? '✓' : '○';
                            return (
                                <option key={event.id} value={event.id}>
                                    {statusMarker} R{event.round}: {event.name} {isLocked ? '(Locked)' : ''}
                                </option>
                            );
                        })}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-highlight-silver">
                        <ChevronDownIcon className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Main Form Area */}
            <div className="max-w-5xl mx-auto">
                {selectedEvent ? (
                    <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 md:p-8 ring-1 ring-pure-white/10 animate-fade-in">
                        <div className="flex justify-between items-center mb-6 border-b border-accent-gray/50 pb-4">
                            <div>
                                <h2 className="text-3xl font-bold">{selectedEvent.name}</h2>
                                <p className="text-highlight-silver">{selectedEvent.country} • Round {selectedEvent.round}</p>
                            </div>
                            {formLocks[selectedEvent.id] && (
                                <div className="bg-primary-red/20 text-primary-red px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-primary-red animate-pulse"></span>
                                    Locked
                                </div>
                            )}
                        </div>

                        <ResultsForm
                            event={selectedEvent}
                            currentResults={raceResults[selectedEvent.id]}
                            onSave={handleSave}
                            allDrivers={allDrivers}
                            isLocked={!!formLocks[selectedEvent.id]}
                            onToggleLock={() => onToggleLock(selectedEvent.id)}
                        />
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 bg-accent-gray/20 rounded-lg border-2 border-dashed border-accent-gray">
                        <AdminIcon className="w-16 h-16 text-accent-gray mb-4" />
                        <h3 className="text-xl font-bold text-highlight-silver mb-2">No Event Selected</h3>
                        <p className="text-highlight-silver/70">Please select an event from the dropdown above to manage results or locks.</p>
                        {filteredEvents.length === 0 && (
                            <p className="mt-4 text-primary-red font-semibold">No events match the current "{filter}" filter.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultsManagerPage;
