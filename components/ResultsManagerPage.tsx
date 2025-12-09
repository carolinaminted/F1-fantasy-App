
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
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors flex-1 ${
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
        <div className="h-[100dvh] flex flex-col max-w-7xl mx-auto text-pure-white overflow-hidden p-2 md:p-4">
            <div className="flex items-center justify-between mb-2 md:mb-4 flex-shrink-0">
                 <button 
                    onClick={() => setAdminSubPage('dashboard')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors text-sm py-2"
                >
                    <BackIcon className="w-4 h-4" />
                    Back
                </button>
                <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 text-right">
                    <span className="hidden md:inline">Results Manager</span>
                    <span className="md:hidden">Results</span>
                    <AdminIcon className="w-6 h-6"/>
                </h1>
            </div>
            
            {/* Control Bar */}
            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-2 md:p-3 mb-2 md:mb-4 ring-1 ring-pure-white/10 flex flex-col md:flex-row gap-2 md:gap-4 items-stretch md:items-center justify-between flex-shrink-0">
                <div className="flex gap-2 w-full md:w-auto p-1 bg-accent-gray/50 rounded-lg">
                    <FilterButton label="All" value="all" current={filter} onClick={setFilter} />
                    <FilterButton label="Done" value="added" current={filter} onClick={setFilter} />
                    <FilterButton label="Todo" value="pending" current={filter} onClick={setFilter} />
                </div>

                <div className="relative w-full md:w-80">
                    <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="w-full appearance-none bg-carbon-black border border-accent-gray rounded-lg py-2.5 pl-4 pr-10 text-pure-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-red cursor-pointer"
                    >
                        <option value="" disabled>Select an event...</option>
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
                        <ChevronDownIcon className="w-4 h-4" />
                    </div>
                </div>
            </div>

            {/* Main Form Area - Expands to fill remaining height */}
            <div className="flex-1 min-h-0 w-full max-w-6xl mx-auto">
                {selectedEvent ? (
                    <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-2 md:p-4 ring-1 ring-pure-white/10 h-full flex flex-col">
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
                    <div className="flex flex-col items-center justify-center h-full bg-accent-gray/20 rounded-lg border-2 border-dashed border-accent-gray m-2">
                        <AdminIcon className="w-12 h-12 text-accent-gray mb-4" />
                        <h3 className="text-lg font-bold text-highlight-silver mb-2">No Event Selected</h3>
                        <p className="text-highlight-silver/70 text-sm">Select an event from the dropdown above.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultsManagerPage;
