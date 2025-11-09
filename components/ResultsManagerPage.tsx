import React, { useState } from 'react';
import { RaceResults, Event, EventResult } from '../types';
import { EVENTS } from '../constants';
import ResultsForm from './ResultsForm';
import { AdminIcon } from './icons/AdminIcon';
import { BackIcon } from './icons/BackIcon';

interface ResultsManagerPageProps {
    raceResults: RaceResults;
    onResultsUpdate: (eventId: string, results: EventResult) => void;
    setAdminSubPage: (page: 'dashboard') => void;
}

const ResultsManagerPage: React.FC<ResultsManagerPageProps> = ({ raceResults, onResultsUpdate, setAdminSubPage }) => {
    const [editingEventId, setEditingEventId] = useState<string | null>(null);

    const handleEditToggle = (eventId: string) => {
        setEditingEventId(prevId => prevId === eventId ? null : eventId);
    };

    const handleSave = (eventId: string, results: EventResult) => {
        onResultsUpdate(eventId, results);
        setEditingEventId(null);
    };

    return (
        <div className="max-w-4xl mx-auto text-pure-white">
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
            
            <div className="space-y-4">
                {EVENTS.map(event => (
                    <div key={event.id} className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                        <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-accent-gray/50" onClick={() => handleEditToggle(event.id)}>
                            <div>
                                <h2 className="text-xl font-bold">R{event.round}: {event.name}</h2>
                                <p className="text-sm text-highlight-silver">{event.country}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {Object.keys(raceResults[event.id] ?? {}).length > 0 && <span className="text-xs font-bold uppercase tracking-wider bg-highlight-silver/20 text-ghost-white px-3 py-1 rounded-full">Results Added</span>}
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
            </div>
        </div>
    );
};

export default ResultsManagerPage;
