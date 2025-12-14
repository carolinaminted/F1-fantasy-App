
import React, { useState, useMemo, useEffect } from 'react';
import { Event, EventSchedule } from '../types.ts';
import { EVENTS } from '../constants.ts';
import { saveEventSchedule } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';

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

    const handleInputChange = (field: keyof EventSchedule, value: string) => {
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
                message: `Schedule for ${selectedEvent?.name} saved successfully!`, 
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
    // We assume data is stored in ISO format. We need to slice it for the input value.
    const getValue = (val?: string) => val ? val.slice(0, 16) : '';

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
                    Schedule Manager <CalendarIcon className="w-8 h-8 text-primary-red"/>
                </h1>
            </div>

            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10 mb-8">
                <div className="mb-6 relative">
                    <label className="block text-sm font-bold text-highlight-silver mb-2">Select Event to Edit</label>
                    <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="w-full appearance-none bg-carbon-black border border-accent-gray rounded-lg py-3 pl-4 pr-10 text-pure-white font-bold focus:outline-none focus:ring-2 focus:ring-primary-red cursor-pointer"
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
                    <form onSubmit={handleSave} className="animate-fade-in space-y-6">
                        <div className="border-t border-pure-white/10 pt-4">
                            <h3 className="text-xl font-bold text-pure-white mb-4 flex items-center gap-2">
                                <span className="bg-primary-red px-2 py-0.5 rounded text-sm uppercase">
                                    {selectedEvent.hasSprint ? 'Sprint Weekend' : 'Standard Weekend'}
                                </span>
                                {selectedEvent.name} Timetable
                            </h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Common Sessions */}
                                <TimeInput 
                                    label="Practice 1" 
                                    value={getValue(scheduleForm.fp1)} 
                                    onChange={(v) => handleInputChange('fp1', v)} 
                                />
                                
                                {selectedEvent.hasSprint ? (
                                    <>
                                        <TimeInput 
                                            label="Sprint Qualifying" 
                                            value={getValue(scheduleForm.sprintQualifying)} 
                                            onChange={(v) => handleInputChange('sprintQualifying', v)} 
                                        />
                                        <TimeInput 
                                            label="Sprint Race" 
                                            value={getValue(scheduleForm.sprint)} 
                                            onChange={(v) => handleInputChange('sprint', v)} 
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
                                    </>
                                )}

                                <TimeInput 
                                    label="Grand Prix Qualifying" 
                                    value={getValue(scheduleForm.qualifying)} 
                                    onChange={(v) => handleInputChange('qualifying', v)} 
                                />
                                <div className="md:col-span-2 bg-carbon-black/30 p-4 rounded-lg border border-primary-red/30">
                                    <TimeInput 
                                        label="Grand Prix Race (Start)" 
                                        value={getValue(scheduleForm.race)} 
                                        onChange={(v) => handleInputChange('race', v)} 
                                        highlight
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg">
                            <h4 className="font-bold text-yellow-500 text-sm uppercase mb-2">Overrides</h4>
                            <p className="text-xs text-highlight-silver mb-3">Optional: Set a custom lock time different from the default (Start of GP Quali or Sprint Quali).</p>
                            <TimeInput 
                                label="Custom Lock Time (UTC)" 
                                value={getValue(scheduleForm.customLockAt)} 
                                onChange={(v) => handleInputChange('customLockAt', v)} 
                            />
                        </div>

                        <div className="flex justify-end pt-4 relative">
                            {notification && (
                                <div className={`absolute bottom-full mb-4 right-0 px-4 py-2 rounded-lg shadow-xl text-sm font-bold animate-fade-in-up flex items-center gap-2 border ${
                                    notification.type === 'success' 
                                    ? 'bg-green-600/90 border-green-500 text-white' 
                                    : 'bg-red-600/90 border-red-500 text-white'
                                }`}>
                                    {notification.type === 'success' ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    )}
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
                    </form>
                )}
            </div>
        </div>
    );
};

const TimeInput: React.FC<{ label: string; value: string; onChange: (val: string) => void; highlight?: boolean }> = ({ label, value, onChange, highlight }) => (
    <div>
        <label className={`block text-xs font-bold uppercase mb-1 ${highlight ? 'text-primary-red' : 'text-highlight-silver'}`}>{label}</label>
        <input 
            type="datetime-local" 
            value={value}
            onChange={(e) => onChange(e.target.value)} // Stores as 'YYYY-MM-DDTHH:MM' which is ISO compliant prefix
            className={`w-full bg-carbon-black border rounded px-3 py-2 text-pure-white focus:outline-none focus:ring-1 focus:ring-primary-red ${highlight ? 'border-primary-red font-bold text-lg' : 'border-accent-gray'}`}
        />
    </div>
);

export default ManageSchedulePage;
