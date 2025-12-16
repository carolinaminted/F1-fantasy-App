
import React, { useState, useMemo, useEffect } from 'react';
import { RaceResults, Event, EventResult, Driver, PointsSystem } from '../types.ts';
import ResultsForm from './ResultsForm.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { useToast } from '../contexts/ToastContext.tsx';

interface ResultsManagerPageProps {
    raceResults: RaceResults;
    onResultsUpdate: (eventId: string, results: EventResult) => Promise<void>;
    setAdminSubPage: (page: 'dashboard') => void;
    allDrivers: Driver[];
    formLocks: { [eventId: string]: boolean };
    onToggleLock: (eventId: string) => void;
    activePointsSystem: PointsSystem; // New prop
    events: Event[];
}

type FilterType = 'all' | 'added' | 'pending';

const ResultsManagerPage: React.FC<ResultsManagerPageProps> = ({ raceResults, onResultsUpdate, setAdminSubPage, allDrivers, formLocks, onToggleLock, activePointsSystem, events }) => {
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [filter, setFilter] = useState<FilterType>('all');
    const { showToast } = useToast();

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
        return events.filter(event => {
            const hasResults = checkHasResults(event);
            if (filter === 'all') return true;
            if (filter === 'added') return hasResults;
            if (filter === 'pending') return !hasResults;
            return true;
        });
    }, [filter, raceResults, events]);

    useEffect(() => {
        if (selectedEventId && !filteredEvents.find(e => e.id === selectedEventId)) {
            setSelectedEventId('');
        }
    }, [filter, filteredEvents, selectedEventId]);

    const handleSave = async (eventId: string, results: EventResult): Promise<boolean> => {
        try {
            // Snapshot 1: Driver Teams (Existing)
            const driverTeamsSnapshot: { [driverId: string]: string } = {};
            allDrivers.forEach(d => {
                driverTeamsSnapshot[d.id] = d.constructorId;
            });

            // Snapshot 2: Scoring Rules (New)
            const resultsWithSnapshot = {
                ...results,
                driverTeams: driverTeamsSnapshot,
                scoringSnapshot: activePointsSystem,
            };

            await onResultsUpdate(eventId, resultsWithSnapshot);
            showToast(`Results for ${eventId} saved successfully!`, 'success');
            return true;
        } catch (error) {
            showToast(`Error: Could not update results for ${eventId}. Please check your connection and try again.`, 'error');
            return false;
        }
    };

    const selectedEvent = useMemo(() => events.find(event => event.id === selectedEventId), [selectedEventId, events]);

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

    const DashboardAction = (
        <button 
            onClick={() => setAdminSubPage('dashboard')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">Dashboard</span>
        </button>
    );

    return (
        <div className="flex flex-col h-full overflow-hidden w-full max-w-7xl mx-auto text-pure-white">
            <div className="flex-none">
                <PageHeader 
                    title="RESULTS MANAGER" 
                    icon={TrackIcon} 
                    leftAction={DashboardAction}
                />
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 flex flex-col px-4 md:px-0 pb-8">
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

                {/* Main Form Area */}
                <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col min-h-0">
                    {selectedEvent ? (
                        <div className="bg-carbon-fiber rounded-lg p-2 md:p-4 border border-pure-white/10 shadow-lg flex-1 flex flex-col min-h-0">
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <ResultsForm
                                    event={selectedEvent}
                                    currentResults={raceResults[selectedEvent.id]}
                                    onSave={handleSave}
                                    allDrivers={allDrivers}
                                    isLocked={!!formLocks[selectedEvent.id]}
                                    onToggleLock={() => onToggleLock(selectedEvent.id)}
                                />
                            </div>
                            <p className="text-center text-[10px] text-highlight-silver mt-2 pt-2 border-t border-pure-white/5 flex-shrink-0">
                                Saving results will lock in the <strong>Active Scoring Profile</strong> rules for this race.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 md:h-full bg-accent-gray/20 rounded-lg border-2 border-dashed border-accent-gray m-2">
                            <TrackIcon className="w-12 h-12 text-accent-gray mb-4" />
                            <h3 className="text-lg font-bold text-highlight-silver mb-2">No Event Selected</h3>
                            <p className="text-highlight-silver/70 text-sm">Select an event from the dropdown above.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResultsManagerPage;
