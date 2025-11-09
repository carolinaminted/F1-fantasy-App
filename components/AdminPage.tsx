import React, { useState } from 'react';
import { RaceResults, Event, EventResult } from '../types';
import { EVENTS } from '../constants';
import ResultsForm from './ResultsForm';
import { AdminIcon } from './icons/AdminIcon';
import { LeaderboardIcon } from './icons/LeaderboardIcon';

interface AdminPageProps {
    raceResults: RaceResults;
    onResultsUpdate: (eventId: string, results: EventResult) => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ raceResults, onResultsUpdate }) => {
    const [editingEventId, setEditingEventId] = useState<string | null>(null);

    const handleEditToggle = (eventId: string) => {
        setEditingEventId(prevId => prevId === eventId ? null : eventId);
    };

    const handleSave = (eventId: string, results: EventResult) => {
        onResultsUpdate(eventId, results);
        setEditingEventId(null);
    };

    return (
        <div className="max-w-4xl mx-auto text-white">
            <h1 className="text-4xl font-bold mb-8 text-center flex items-center justify-center gap-3">
                <AdminIcon className="w-8 h-8"/> Admin Panel: Results
            </h1>
            <div className="space-y-4">
                {EVENTS.map(event => (
                    <div key={event.id} className="bg-gray-800/50 backdrop-blur-sm rounded-lg ring-1 ring-white/10 overflow-hidden">
                        <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-700/50" onClick={() => handleEditToggle(event.id)}>
                            <div>
                                <h2 className="text-xl font-bold">R{event.round}: {event.name}</h2>
                                <p className="text-sm text-gray-400">{event.country}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                {Object.keys(raceResults[event.id] ?? {}).length > 0 && <span className="text-xs font-bold uppercase tracking-wider bg-green-500/20 text-green-400 px-3 py-1 rounded-full">Results Added</span>}
                                <button className="bg-[#ff8400] hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg">
                                    {editingEventId === event.id ? 'Close' : 'Manage'}
                                </button>
                            </div>
                        </div>
                        {editingEventId === event.id && (
                            <div className="p-4 border-t border-gray-700">
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

export default AdminPage;
