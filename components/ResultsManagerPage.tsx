import React, { useState, useMemo, useEffect } from 'react';
import { RaceResults, Event, EventResult, Driver, PointsSystem, Constructor } from '../types.ts';
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
    allConstructors: Constructor[]; // New prop
    formLocks: { [eventId: string]: boolean };
    onToggleLock: (eventId: string) => void;
    activePointsSystem: PointsSystem; // New prop
    events: Event[];
}

type FilterType = 'all' | 'added' | 'pending';

const ResultsManagerPage: React.FC<ResultsManagerPageProps> = ({ raceResults, onResultsUpdate, setAdminSubPage, allDrivers, allConstructors, formLocks, onToggleLock, activePointsSystem, events }) => {
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
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex-1 ${
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
        <div className="flex flex-col w-full max-w-7xl mx-auto text-pure-white h-full md:overflow-hidden">
            <div className="flex-none">
                <PageHeader 
                    title="RESULTS MANAGER" 
                    icon={TrackIcon} 
                    leftAction={DashboardAction}
                />
            </div>
            
            <div className="flex-1 flex flex-col px-4 md:px-0 md:min-h-0">
                {/* Control Bar */}
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-xl p-3 md:p-4 mb-4 md:mb-6 ring-1 ring-pure-white/10 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between flex-shrink-0 shadow-lg">
                    <div className="flex gap-2 w-full md:w-auto p-1 bg-accent-gray/50 rounded-lg">
                        <FilterButton label="All Rounds" value="all" current={filter} onClick={setFilter} />
                        <FilterButton label="Done" value="added" current={filter} onClick={setFilter} />
                        <FilterButton label="Pending" value="pending" current={filter} onClick={setFilter} />
                    </div>

                    <div className="relative w-full md:w-80">
                        <select
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                            className="w-full appearance-none bg-carbon-black border border-accent-gray rounded-lg py-3 pl-4 pr-10 text-pure-white text-sm font-black uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-primary-red cursor-pointer shadow-inner transition-all hover:border-highlight-silver"
                        >
                            <option value="" disabled>Select GP Weekend...</option>
                            {filteredEvents.map(event => {
                                const isLocked = formLocks[event.id];
                                const hasResults = checkHasResults(event);
                                const statusMarker = hasResults ? '✓' : '○';
                                return (
                                    <option key={event.id} value={event.id}>
                                        {statusMarker} R{event.round}: {event.name} {isLocked ? '(LOCKED)' : ''}
                                    </option>
                                );
                            })}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-highlight-silver">
                            <ChevronDownIcon className="w-5 h-5" />
                        </div>
                    </div>
                </div>

                {/* Main Form Area - Scrollable Container */}
                <div className="w-full max-w-6xl mx-auto flex-1 md:overflow-y-auto custom-scrollbar md:pr-2 pb-32 md:pb-12 min-h-0">
                    {selectedEvent ? (
                        <div className="bg-carbon-fiber rounded-xl p-4 md:p-6 border border-pure-white/10 shadow-2xl flex flex-col mb-4">
                            <ResultsForm
                                event={selectedEvent}
                                currentResults={raceResults[selectedEvent.id]}
                                onSave={handleSave}
                                allDrivers={allDrivers}
                                allConstructors={allConstructors}
                                isLocked={!!formLocks[selectedEvent.id]}
                                onToggleLock={() => onToggleLock(selectedEvent.id)}
                            />
                            <p className="text-center text-[10px] font-bold uppercase tracking-widest text-highlight-silver mt-6 pt-4 border-t border-pure-white/5 opacity-50">
                                Recalculation engine triggers automatically upon saving.
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 md:h-full min-h-[400px] bg-accent-gray/20 rounded-xl border-2 border-dashed border-accent-gray/50 m-2">
                            <TrackIcon className="w-16 h-16 text-accent-gray mb-6 opacity-20" />
                            <h3 className="text-xl font-bold text-highlight-silver mb-2">Awaiting Race Telemetry</h3>
                            <p className="text-highlight-silver/50 text-sm max-w-xs text-center">Select an event from the roster above to manage session results and lock statuses.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResultsManagerPage;