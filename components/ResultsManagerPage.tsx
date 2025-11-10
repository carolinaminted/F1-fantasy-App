import React, { useState, useMemo } from 'react';
import { RaceResults, Event, EventResult } from '../types.ts';
import { EVENTS } from '../constants.ts';
import ResultsForm from './ResultsForm.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';

interface ResultsManagerPageProps {
    raceResults: RaceResults;
    onResultsUpdate: (eventId: string, results: EventResult) => void;
    setAdminSubPage: (page: 'dashboard') => void;
}

type FilterType = 'all' | 'added' | 'pending';

const ResultsManagerPage: React.FC<ResultsManagerPageProps> = ({ raceResults, onResultsUpdate, setAdminSubPage }) => {
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [filter, setFilter] = useState<FilterType>('all');

    const handleEditToggle = (eventId: string) => {
        setEditingEventId(prevId => prevId === eventId ? null : eventId);
    };

    const handleSave = (eventId: string, results: EventResult) => {
        onResultsUpdate(eventId, results);
        setEditingEventId(null);
    };

    const checkHasResults = (event: Event): boolean => {
        const results = raceResults[event.id];
        if (!results) return false;
        const hasGpFinish = results.grandPrixFinish?.some(pos => pos !== null && pos !== undefined);
        const hasFastestLap = !!results.fastestLap;
        return hasGpFinish || hasFastestLap;
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

    const FilterButton: React.FC<{label: string, value: FilterType, current: FilterType, onClick: (val: FilterType) => void}> = ({ label, value, current, onClick }) => {
        const isActive = value === current;
        return (
            <button
                onClick={() => onClick(value)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
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
            
            <div className="flex items-center justify-center gap-2 mb-6 p-2 rounded-lg bg-accent-gray/50 w-fit mx-auto">
                <FilterButton label="Show All" value="all" current={filter} onClick={setFilter} />
                <FilterButton label="Results Added" value="added" current={filter} onClick={setFilter} />
                <FilterButton label="Needs Results" value="pending" current={filter} onClick={setFilter} />
            </div>

            <div className="space-y-4">
                {filteredEvents.map(event => (
                    <div key={event.id} className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                        <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-accent-gray/50" onClick={() => handleEditToggle(event.id)}>
                            <div>
                                <h2 className="text-xl font-bold">R{event.round}: {event.name}</h2>
                                <p className="text-sm text-highlight-silver">{event.country}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {checkHasResults(event) && <span className="text-xs font-bold uppercase tracking-wider bg-highlight-silver/20 text-ghost-white px-3 py-1 rounded-full">Results Added</span>}
                                <button className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-4 rounded-lg">
                                    {editingEventId === event.id ? 'Close' : 'Manage'}
                                </button>
                            </div>
                        </div>
                        {editingEventId === event.id && (
                            <div className="p-4 border-t border-accent-gray">
                                <ResultsForm
                                    event={event}
                                    currentResults={raceResults[event.id]}
                                    onSave={handleSave}
                                />
                            </div>
                        )}
                    </div>
                ))}
                {filteredEvents.length === 0 && (
                    <div className="text-center py-12 bg-accent-gray/30 rounded-lg">
                        <p className="text-highlight-silver">No events match the current filter.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResultsManagerPage;