
import React, { useState, useMemo, useEffect } from 'react';
import { Event, EventSchedule } from '../types.ts';
import { EVENTS } from '../constants.ts';
import { saveEventSchedule } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';

interface ManageSchedulePageProps {
    setAdminSubPage: (page: 'dashboard') => void;
    existingSchedules: { [eventId: string]: EventSchedule };
    onScheduleUpdate: () => void;
}

const ManageSchedulePage: React.FC<ManageSchedulePageProps> = ({ setAdminSubPage, existingSchedules, onScheduleUpdate }) => {
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [scheduleForm, setScheduleForm] = useState<Partial<EventSchedule>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const selectedEvent = useMemo(() => EVENTS.find(e => e.id === selectedEventId), [selectedEventId]);

    // When event is selected, populate form
    useEffect(() => {
        if (selectedEventId) {
            const existing = existingSchedules[selectedEventId];
            if (existing) {
                setScheduleForm({ ...existing });
            } else {
                setScheduleForm({ eventId: selectedEventId });
            }
        } else {
            setScheduleForm({});
        }
        setNotification(null);
    }, [selectedEventId, existingSchedules]);

    const handleInputChange = (field: keyof EventSchedule, value: string | boolean) => {
        setScheduleForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedEventId || !scheduleForm) return;

        setIsSaving(true);
        setNotification(null);
        try {
            // Ensure eventId is set
            const finalData = { ...scheduleForm, eventId: selectedEventId } as EventSchedule;
            await saveEventSchedule(selectedEventId, finalData);
            onScheduleUpdate(); // Trigger refresh in parent
            
            setNotification({ 
                message: `Schedule for ${scheduleForm.name || selectedEvent?.name} saved successfully!`, 
                type: 'success' 
            });

            // Clear notification after 3 seconds
            setTimeout(() => {
                setNotification(null);
            }, 3000);

        } catch (error) {
            console.error("Failed to save schedule:", error);
            setNotification({ 
                message: "Error saving schedule. Please try again.", 
                type: 'error' 
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Helper for datetime inputs (expects YYYY-MM-DDTHH:MM)
    const getValue = (val?: string) => val ? val.slice(0, 16) : '';

    // Determine effective sprint status (Override > Default)
    const isSprint = scheduleForm.hasSprint !== undefined ? scheduleForm.hasSprint : selectedEvent?.hasSprint;

    return (
        <div className="flex flex-col w-full max-w-7xl mx-auto text-pure-white md:h-[calc(100vh-6rem)] md:overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
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

            <div className="bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-2xl flex-1 flex flex-col overflow-hidden relative">
                <div className="p-6 md:p-8 h-full flex flex-col">
                    
                    {/* Top Selector */}
                    <div className="mb-6 relative flex-shrink-0">
                        <label className="block text-sm font-bold text-highlight-silver mb-2">Select Event to Edit</label>
                        <select
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                            className="w-full appearance-none bg-carbon-black border border-accent-gray rounded-lg py-3 pl-4 pr-10 text-pure-white font-bold focus:outline-none focus:ring-2 focus:ring-primary-red cursor-pointer hover:border-highlight-silver transition-colors"
                        >
                            <option value="" disabled>Choose a Grand Prix...</option>
                            {EVENTS.map(event => (
                                <option key={event.id} value={event.id}>
                                    R{event.round}: {event.name} {existingSchedules[event.id] ? '✓' : ''}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute bottom-3 right-3 text-highlight-silver">
                            <ChevronDownIcon className="w-5 h-5" />
                        </div>
                    </div>

                    {selectedEvent && (
                        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 animate-fade-in">
                            
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 min-h-0">
                                {/* Left Column: Config & Overrides */}
                                <div className="flex flex-col gap-6 overflow-hidden justify-center">
                                    <div className="bg-carbon-black/30 p-5 rounded-xl border border-pure-white/10 flex-shrink-0">
                                        <h4 className="font-bold text-pure-white mb-4 uppercase text-xs tracking-wider border-b border-pure-white/5 pb-2">Event Configuration</h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Grand Prix Name</label>
                                                <input 
                                                    type="text" 
                                                    value={scheduleForm.name !== undefined ? scheduleForm.name : selectedEvent.name}
                                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                                    className="w-full bg-carbon-black border border-accent-gray rounded px-3 py-2 text-pure-white focus:outline-none focus:ring-1 focus:ring-primary-red"
                                                />
                                            </div>
                                            <div className="flex items-center">
                                                <label className="flex items-center gap-3 cursor-pointer group">
                                                    <div className="relative">
                                                        <input 
                                                            type="checkbox" 
                                                            className="sr-only" 
                                                            checked={!!isSprint}
                                                            onChange={(e) => handleInputChange('hasSprint', e.target.checked)}
                                                        />
                                                        <div className={`block w-10 h-6 rounded-full transition-colors ${isSprint ? 'bg-yellow-500' : 'bg-carbon-black border border-highlight-silver group-hover:border-pure-white'}`}></div>
                                                        <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isSprint ? 'transform translate-x-4' : ''}`}></div>
                                                    </div>
                                                    <div>
                                                        <span className="block font-bold text-sm text-pure-white">Sprint Weekend</span>
                                                        <span className="text-xs text-highlight-silver">Enable sprint sessions</span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-yellow-500/5 border border-yellow-500/20 p-5 rounded-xl flex-shrink-0">
                                        <h4 className="font-bold text-yellow-500 text-sm uppercase mb-2">Overrides</h4>
                                        <p className="text-xs text-highlight-silver mb-3">Optional: Set a custom lock time different from the default (Start of GP Quali or Sprint Quali).</p>
                                        <TimeInput 
                                            label="Custom Lock Time (UTC)" 
                                            value={getValue(scheduleForm.customLockAt)} 
                                            onChange={(v) => handleInputChange('customLockAt', v)} 
                                        />
                                    </div>
                                </div>

                                {/* Right Column: Timetable */}
                                <div className="flex flex-col h-full overflow-hidden justify-center">
                                    <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isSprint ? 'bg-yellow-500 text-black' : 'bg-primary-red text-pure-white'}`}>
                                            {isSprint ? 'Sprint Format' : 'Standard Format'}
                                        </span>
                                        <h3 className="text-lg font-bold text-pure-white">Timetable</h3>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 content-start flex-1 overflow-hidden">
                                        <TimeInput 
                                            label="Practice 1" 
                                            value={getValue(scheduleForm.fp1)} 
                                            onChange={(v) => handleInputChange('fp1', v)} 
                                        />
                                        
                                        {isSprint ? (
                                            <>
                                                <TimeInput 
                                                    label="Practice 2 (Sprint Quali)" 
                                                    value={getValue(scheduleForm.sprintQualifying)} 
                                                    onChange={(v) => handleInputChange('sprintQualifying', v)} 
                                                />
                                                <TimeInput 
                                                    label="Sprint Race" 
                                                    value={getValue(scheduleForm.sprint)} 
                                                    onChange={(v) => handleInputChange('sprint', v)} 
                                                />
                                                <TimeInput 
                                                    label="Grand Prix Qualifying" 
                                                    value={getValue(scheduleForm.qualifying)} 
                                                    onChange={(v) => handleInputChange('qualifying', v)} 
                                                />
                                            </>
                                        ) : (
                                            <>
                                                <TimeInput 
                                                    label="Practice 2" 
                                                    value={getValue(scheduleForm.fp2)} 
                                                    onChange={(v) => handleInputChange('fp2', v)} 
                                                />
                                                <TimeInput 
                                                    label="Practice 3" 
                                                    value={getValue(scheduleForm.fp3)} 
                                                    onChange={(v) => handleInputChange('fp3', v)} 
                                                />
                                                <div className="col-span-2 md:col-span-1">
                                                    <TimeInput 
                                                        label="Grand Prix Qualifying" 
                                                        value={getValue(scheduleForm.qualifying)} 
                                                        onChange={(v) => handleInputChange('qualifying', v)} 
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div className="col-span-2 bg-carbon-black/40 p-3 rounded-lg border border-primary-red/30 mt-2">
                                            <TimeInput 
                                                label="Grand Prix Race (Start)" 
                                                value={getValue(scheduleForm.race)} 
                                                onChange={(v) => handleInputChange('race', v)} 
                                                highlight
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer / Actions */}
                            <div className="mt-auto pt-6 border-t border-pure-white/10 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2 opacity-30">
                                    <F1CarIcon className="w-5 h-5 text-pure-white" />
                                    <span className="text-[10px] text-highlight-silver uppercase tracking-widest hidden sm:inline">Formula Fantasy One © {new Date().getFullYear()}</span>
                                </div>

                                <div className="relative">
                                    {notification && (
                                        <div className={`absolute bottom-full mb-4 right-0 px-4 py-2 rounded-lg shadow-xl text-sm font-bold animate-fade-in-up flex items-center gap-2 border whitespace-nowrap ${
                                            notification.type === 'success' 
                                            ? 'bg-green-600/90 border-green-500 text-white' 
                                            : 'bg-red-600/90 border-red-500 text-white'
                                        }`}>
                                            {notification.message}
                                        </div>
                                    )}
                                    <button
                                        type="submit"
                                        disabled={isSaving}
                                        className="bg-green-600 hover:bg-green-500 text-pure-white font-bold py-3 px-8 rounded-lg shadow-lg disabled:opacity-50 transition-all transform hover:scale-105"
                                    >
                                        {isSaving ? 'Saving...' : 'Save Schedule'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
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
            onChange={(e) => onChange(e.target.value)} // Stores as 'YYYY-MM-DDTHH:MM' which is ISO compliant prefix
            className={`w-full bg-carbon-black border rounded px-3 py-2 text-pure-white text-sm focus:outline-none focus:ring-1 focus:ring-primary-red ${highlight ? 'border-primary-red font-bold text-base' : 'border-accent-gray'}`}
        />
    </div>
);

export default ManageSchedulePage;
