
import React, { useState, useMemo, useEffect } from 'react';
import { Event, EventSchedule } from '../types.ts';
import { EVENTS } from '../constants.ts';
import { saveEventSchedule } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { CircuitRoute } from './icons/CircuitRoutes.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';

interface ManageSchedulePageProps {
    setAdminSubPage: (page: 'dashboard') => void;
    existingSchedules: { [eventId: string]: EventSchedule };
    onScheduleUpdate: () => void;
}

const ManageSchedulePage: React.FC<ManageSchedulePageProps> = ({ setAdminSubPage, existingSchedules, onScheduleUpdate }) => {
    return (
        <div className="flex flex-col w-full max-w-7xl mx-auto text-pure-white md:h-[calc(100vh-6rem)]">
            <div className="flex items-center justify-between mb-4 flex-shrink-0 px-4 md:px-0">
                 <button 
                    onClick={() => setAdminSubPage('dashboard')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                >
                    <BackIcon className="w-5 h-5" />
                    Back
                </button>
                <h1 className="text-3xl font-bold flex items-center gap-3 text-right">
                    Schedule Manager <CalendarIcon className="w-8 h-8 text-primary-red"/>
                </h1>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-0 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 perspective-1000">
                    {EVENTS.map(event => (
                        <FlippableEventCard 
                            key={event.id}
                            event={event}
                            schedule={existingSchedules[event.id]}
                            onSave={async (data) => {
                                await saveEventSchedule(event.id, data);
                                onScheduleUpdate();
                            }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

interface FlippableEventCardProps {
    event: Event;
    schedule?: EventSchedule;
    onSave: (data: EventSchedule) => Promise<void>;
}

const FlippableEventCard: React.FC<FlippableEventCardProps> = ({ event, schedule, onSave }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formState, setFormState] = useState<Partial<EventSchedule>>(schedule || { eventId: event.id });

    // Sync form state if prop updates (e.g. after save)
    useEffect(() => {
        if (schedule) {
            setFormState(schedule);
        }
    }, [schedule]);

    const handleFlip = () => {
        if (!isSaving) setIsFlipped(!isFlipped);
    };

    const handleSaveClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsSaving(true);
        try {
            await onSave({ ...formState, eventId: event.id } as EventSchedule);
            setIsFlipped(false); // Flip back on success
        } catch (err) {
            console.error(err);
            alert("Failed to save schedule.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (field: keyof EventSchedule, value: string | boolean) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const getValue = (val?: string) => val ? val.slice(0, 16) : '';
    const isSprint = formState.hasSprint !== undefined ? formState.hasSprint : event.hasSprint;

    // Card Colors
    const accentColor = isSprint ? '#EAB308' : '#DA291C'; // Yellow or Red
    const hasData = !!schedule?.race;

    return (
        <div className="relative w-full h-[580px] group [perspective:1000px]">
            <div 
                className={`relative w-full h-full transition-all duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}
            >
                {/* --- FRONT FACE --- */}
                <div 
                    onClick={handleFlip}
                    className="absolute w-full h-full [backface-visibility:hidden] bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-xl overflow-hidden cursor-pointer hover:border-primary-red/50 transition-colors flex flex-col"
                >
                    {/* Hero Image / Map Area */}
                    <div className="h-40 bg-carbon-black/50 relative flex items-center justify-center border-b border-pure-white/10">
                        <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, transparent 100%)` }}></div>
                        <CircuitRoute eventId={event.id} className="w-32 h-32 text-highlight-silver opacity-80" />
                        
                        <div className="absolute top-3 right-3">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${hasData ? 'bg-green-900/30 text-green-400 border-green-500/30' : 'bg-carbon-black/50 text-highlight-silver border-pure-white/10'}`}>
                                {hasData ? 'Scheduled' : 'Pending'}
                            </span>
                        </div>
                    </div>

                    <div className="p-6 flex-1 flex flex-col relative">
                        <div className="mb-4">
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-bold text-highlight-silver uppercase tracking-wider">Round {event.round}</span>
                                {isSprint && <SprintIcon className="w-4 h-4 text-yellow-500" />}
                            </div>
                            <h3 className="text-2xl font-black text-pure-white leading-tight mb-1">{event.name}</h3>
                            <p className="text-sm text-highlight-silver">{event.location}, {event.country}</p>
                        </div>

                        {schedule?.race ? (
                            <div className="space-y-3 mt-2">
                                <div className="flex justify-between items-center py-2 border-b border-pure-white/5">
                                    <span className="text-xs font-bold text-highlight-silver uppercase">Qualifying</span>
                                    <span className="text-sm font-mono text-pure-white">{new Date(schedule.qualifying!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 border-b border-pure-white/5">
                                    <span className="text-xs font-bold text-primary-red uppercase">Race</span>
                                    <div className="text-right">
                                        <div className="text-sm font-bold text-pure-white">{new Date(schedule.race).toLocaleDateString()}</div>
                                        <div className="text-xs font-mono text-highlight-silver">{new Date(schedule.race).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-highlight-silver/30 text-sm italic">
                                No schedule data configured.
                            </div>
                        )}

                        <div className="mt-auto pt-6 text-center">
                            <span className="inline-flex items-center gap-2 text-sm font-bold text-pure-white group-hover:text-primary-red transition-colors">
                                Edit Schedule <span>&rarr;</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* --- BACK FACE (FORM) --- */}
                <div 
                    className="absolute w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-carbon-black rounded-xl border border-accent-gray shadow-2xl overflow-hidden flex flex-col"
                >
                    <div className="bg-accent-gray/20 p-4 border-b border-pure-white/10 flex justify-between items-center">
                        <h3 className="font-bold text-pure-white flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary-red animate-pulse"></span>
                            Editing {event.name}
                        </h3>
                        <button 
                            onClick={handleFlip}
                            type="button"
                            className="text-highlight-silver hover:text-pure-white text-xs uppercase font-bold"
                        >
                            Cancel
                        </button>
                    </div>

                    <div className="p-5 flex-1 overflow-y-auto custom-scrollbar space-y-4 bg-carbon-fiber/50">
                        {/* Config Section */}
                        <div className="bg-carbon-black/60 p-3 rounded-lg border border-pure-white/5 space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-highlight-silver uppercase mb-1">Display Name Override</label>
                                <input 
                                    type="text" 
                                    value={formState.name !== undefined ? formState.name : event.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    className="w-full bg-carbon-black border border-accent-gray rounded px-2 py-1.5 text-sm text-pure-white focus:outline-none focus:border-primary-red"
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={!!isSprint}
                                    onChange={(e) => handleInputChange('hasSprint', e.target.checked)}
                                    className="accent-primary-red"
                                />
                                <span className="text-xs font-bold text-pure-white">Sprint Weekend</span>
                            </label>
                        </div>

                        {/* Sessions */}
                        <div className="space-y-3">
                            <TimeInput label="Practice 1" value={getValue(formState.fp1)} onChange={v => handleInputChange('fp1', v)} />
                            
                            {isSprint ? (
                                <>
                                    <TimeInput label="Sprint Quali (Fri)" value={getValue(formState.sprintQualifying)} onChange={v => handleInputChange('sprintQualifying', v)} />
                                    <TimeInput label="Sprint Race (Sat)" value={getValue(formState.sprint)} onChange={v => handleInputChange('sprint', v)} />
                                    <TimeInput label="Grand Prix Quali (Sat)" value={getValue(formState.qualifying)} onChange={v => handleInputChange('qualifying', v)} />
                                </>
                            ) : (
                                <>
                                    <TimeInput label="Practice 2" value={getValue(formState.fp2)} onChange={v => handleInputChange('fp2', v)} />
                                    <TimeInput label="Practice 3" value={getValue(formState.fp3)} onChange={v => handleInputChange('fp3', v)} />
                                    <TimeInput label="Qualifying" value={getValue(formState.qualifying)} onChange={v => handleInputChange('qualifying', v)} />
                                </>
                            )}

                            <div className="pt-2 border-t border-pure-white/10">
                                <TimeInput label="Grand Prix Race" value={getValue(formState.race)} onChange={v => handleInputChange('race', v)} highlight />
                            </div>
                            
                            <div className="pt-2">
                                <TimeInput label="Custom Lock Time (Optional)" value={getValue(formState.customLockAt)} onChange={v => handleInputChange('customLockAt', v)} />
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t border-pure-white/10 bg-carbon-black flex justify-between items-center">
                        <button 
                            type="button" 
                            onClick={handleFlip}
                            className="px-4 py-2 text-xs font-bold text-highlight-silver hover:text-pure-white transition-colors"
                        >
                            Discard
                        </button>
                        <button 
                            type="button"
                            onClick={handleSaveClick}
                            disabled={isSaving}
                            className="bg-primary-red hover:bg-red-600 text-pure-white font-bold py-2 px-6 rounded-lg shadow-lg shadow-primary-red/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait transition-all transform hover:scale-105"
                        >
                            {isSaving ? 'Saving...' : <><SaveIcon className="w-4 h-4" /> Save Record</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const TimeInput: React.FC<{ label: string; value: string; onChange: (val: string) => void; highlight?: boolean }> = ({ label, value, onChange, highlight }) => (
    <div>
        <label className={`block text-[10px] font-bold uppercase mb-1 ${highlight ? 'text-primary-red' : 'text-highlight-silver'}`}>{label}</label>
        <input 
            type="datetime-local" 
            value={value}
            onClick={(e) => e.stopPropagation()} // Prevent flip when clicking input
            onChange={(e) => onChange(e.target.value)} 
            className={`w-full bg-carbon-black border rounded px-2 py-1.5 text-pure-white text-xs focus:outline-none focus:ring-1 focus:ring-primary-red ${highlight ? 'border-primary-red/50 bg-primary-red/5' : 'border-accent-gray'}`}
        />
    </div>
);

export default ManageSchedulePage;
