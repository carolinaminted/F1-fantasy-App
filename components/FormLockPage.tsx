
import React from 'react';
import { EVENTS } from '../constants.ts';
import { LockIcon } from './icons/LockIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';

interface FormLockPageProps {
    formLocks: { [eventId: string]: boolean };
    onToggleLock: (eventId: string) => void;
    setAdminSubPage: (page: 'dashboard') => void;
}

const FormLockPage: React.FC<FormLockPageProps> = ({ formLocks, onToggleLock, setAdminSubPage }) => {
    
    const EventCard: React.FC<{ event: typeof EVENTS[0] }> = ({ event }) => {
        const isLocked = formLocks[event.id] || false;
        return (
            <div className="bg-accent-gray/50 rounded-lg p-4 mb-3 border border-pure-white/5">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="font-bold text-pure-white text-lg">R{event.round}: {event.name}</h3>
                        <p className="text-highlight-silver text-sm">{event.country}</p>
                        <p className="text-highlight-silver/50 text-xs">{event.location}</p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${isLocked ? 'bg-primary-red text-pure-white' : 'bg-carbon-black/50 text-highlight-silver'}`}>
                        {isLocked ? 'Locked' : 'Unlocked'}
                    </span>
                </div>
                 <button 
                    onClick={() => onToggleLock(event.id)}
                    className={`font-bold py-2.5 px-4 rounded-lg w-full mt-2 transition-colors ${isLocked ? 'bg-highlight-silver/20 hover:bg-highlight-silver/30 text-pure-white' : 'bg-primary-red hover:opacity-90 text-pure-white'}`}
                >
                    {isLocked ? 'Unlock Picks' : 'Lock Picks'}
                </button>
            </div>
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
                <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3 text-right">
                    Form Lock Manager <LockIcon className="w-8 h-8"/>
                </h1>
            </div>
            
            {/* Mobile View */}
            <div className="md:hidden">
                {EVENTS.map(event => <EventCard key={event.id} event={event} />)}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-carbon-black/50">
                        <tr>
                            <th className="p-4 text-sm font-semibold uppercase text-highlight-silver">Event</th>
                            <th className="p-4 text-sm font-semibold uppercase text-highlight-silver text-center">Status</th>
                            <th className="p-4 text-sm font-semibold uppercase text-highlight-silver text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {EVENTS.map(event => {
                            const isLocked = formLocks[event.id] || false;
                            return (
                                <tr key={event.id} className="border-t border-accent-gray/50 hover:bg-pure-white/5">
                                    <td className="p-4">
                                        <p className="font-semibold text-ghost-white">R{event.round}: {event.name}</p>
                                        <p className="text-xs text-highlight-silver">{event.country} <span className="opacity-50 mx-1">•</span> {event.location}</p>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${isLocked ? 'bg-primary-red text-pure-white' : 'bg-carbon-black/50 text-highlight-silver'}`}>
                                            {isLocked ? 'Locked' : 'Unlocked'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button 
                                            onClick={() => onToggleLock(event.id)}
                                            className={`font-bold py-2 px-4 rounded-lg w-28 transition-colors ${isLocked ? 'bg-highlight-silver/30 hover:bg-highlight-silver/50 text-pure-white' : 'bg-primary-red hover:opacity-90 text-pure-white'}`}
                                        >
                                            {isLocked ? 'Unlock' : 'Lock'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FormLockPage;
