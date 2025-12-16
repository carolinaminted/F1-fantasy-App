
import React, { useState, useEffect } from 'react';
import { Event, EventSchedule } from '../types.ts';
import { EVENTS } from '../constants.ts';
import { saveEventSchedule } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { CircuitRoute } from './icons/CircuitRoutes.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { useToast } from '../contexts/ToastContext.tsx';

interface ManageSchedulePageProps {
    setAdminSubPage: (page: 'dashboard') => void;
    existingSchedules: { [eventId: string]: EventSchedule };
    onScheduleUpdate: () => void;
}

const ManageSchedulePage: React.FC<ManageSchedulePageProps> = ({ setAdminSubPage, existingSchedules, onScheduleUpdate }) => {
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const { showToast } = useToast();

    const handleSave = async (eventId: string, data: EventSchedule) => {
        try {
            await saveEventSchedule(eventId, data);
            onScheduleUpdate();
            showToast(`Schedule updated for ${data.name || eventId}`, 'success');
            setEditingEventId(null);
        } catch (error) {
            console.error(error);
            showToast("Failed to save schedule.", 'error');
        }
    };

    const selectedEvent = EVENTS.find(e => e.id === editingEventId);

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
                    title="SCHEDULE MANAGER" 
                    icon={CalendarIcon} 
                    leftAction={DashboardAction}
                />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-0 pb-8 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {EVENTS.map(event => (
                        <EventSummaryTile 
                            key={event.id}
                            event={event}
                            schedule={existingSchedules[event.id]}
                            onClick={() => setEditingEventId(event.id)}
                        />
                    ))}
                </div>
            </div>

            {selectedEvent && (
                <ScheduleEditorModal 
                    event={selectedEvent}
                    schedule={existingSchedules[selectedEvent.id]}
                    onClose={() => setEditingEventId(null)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

interface EventSummaryTileProps {
    event: Event;
    schedule?: EventSchedule;
    onClick: () => void;
}

const EventSummaryTile: React.FC<EventSummaryTileProps> = ({ event, schedule, onClick }) => {
    const hasData = !!schedule?.race;
    const isSprint = schedule?.hasSprint !== undefined ? schedule.hasSprint : event.hasSprint;
    const accentColor = isSprint ? '#EAB308' : '#DA291C'; // Yellow or Red

    return (
        <button 
            onClick={onClick}
            className="w-full text-left relative overflow-hidden rounded-xl bg-carbon-fiber border border-pure-white/10 hover:border-primary-red/50 shadow-lg hover:shadow-2xl transition-all duration-300 group flex flex-row md:flex-col h-full min-h-[140px]"
        >
            {/* Visual Header (Left on mobile, Top on desktop) */}
            <div className="w-32 md:w-full md:h-32 bg-carbon-black/50 relative flex items-center justify-center border-r md:border-r-0 md:border-b border-pure-white/10 flex-shrink-0">
                <div className="absolute inset-0 opacity-20" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, transparent 100%)` }}></div>
                <CircuitRoute eventId={event.id} className="w-20 h-20 md:w-24 md:h-24 text-highlight-silver opacity-80 group-hover:scale-110 transition-transform duration-500" />
                
                {/* Status Badge */}
                <div className="absolute top-2 right-2">
                    {hasData ? (
                        <span className="w-2 h-2 block rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.8)]"></span>
                    ) : (
                        <span className="w-2 h-2 block rounded-full bg-highlight-silver/30"></span>
                    )}
                </div>
            </div>

            <div className="flex-1 p-4 flex flex-col justify-center">
                <div className="mb-1">
                    <span className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider">Round {event.round}</span>
                    <h3 className="text-lg font-bold text-pure-white leading-tight truncate">{schedule?.name || event.name}</h3>
                </div>
                <p className="text-xs text-highlight-silver truncate">{event.location}, {event.country}</p>
                
                <div className="mt-3 flex items-center gap-2">
                    {isSprint && (
                        <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 text-[10px] px-2 py-0.5 rounded border border-yellow-500/20 font-bold uppercase">
                            <SprintIcon className="w-3 h-3" /> Sprint
                        </div>
                    )}
                    {hasData && (
                        <div className="text-[10px] font-mono text-highlight-silver border border-pure-white/10 px-2 py-0.5 rounded bg-carbon-black/50">
                            {new Date(schedule!.race!).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
};

interface ScheduleEditorModalProps {
    event: Event;
    schedule?: EventSchedule;
    onClose: () => void;
    onSave: (eventId: string, data: EventSchedule) => Promise<void>;
}

const ScheduleEditorModal: React.FC<ScheduleEditorModalProps> = ({ event, schedule, onClose, onSave }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [formState, setFormState] = useState<Partial<EventSchedule>>(schedule || { eventId: event.id });

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(event.id, { ...formState, eventId: event.id } as EventSchedule);
        setIsSaving(false);
    };

    const handleInputChange = (field: keyof EventSchedule, value: string | boolean) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const getValue = (val?: string) => val ? val.slice(0, 16) : '';
    const isSprint = formState.hasSprint !== undefined ? formState.hasSprint : event.hasSprint;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-pure-white/10 bg-carbon-black/50">
                    <div>
                        <h2 className="text-xl font-bold text-pure-white flex items-center gap-2">
                            {event.name}
                            <span className="text-xs font-normal text-highlight-silver bg-pure-white/5 px-2 py-0.5 rounded">Round {event.round}</span>
                        </h2>
                        <p className="text-xs text-highlight-silver mt-1">{event.country} • {event.circuit}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-pure-white/10 rounded-full text-highlight-silver hover:text-pure-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    
                    {/* General Settings */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-highlight-silver uppercase mb-1.5">Display Name</label>
                                <input 
                                    type="text" 
                                    value={formState.name !== undefined ? formState.name : event.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    className="w-full bg-carbon-black border border-accent-gray rounded-lg px-3 py-2 text-sm text-pure-white focus:outline-none focus:border-primary-red transition-colors"
                                />
                            </div>
                            
                            {/* Yellow Themed Sprint Toggle */}
                            <div>
                                <label className="block text-xs font-bold text-highlight-silver uppercase mb-1.5 opacity-0">Format</label>
                                <label className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border transition-all cursor-pointer h-[38px] ${isSprint ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-carbon-black border-accent-gray hover:border-highlight-silver'}`}>
                                    <input 
                                        type="checkbox" 
                                        checked={!!isSprint}
                                        onChange={(e) => handleInputChange('hasSprint', e.target.checked)}
                                        className="w-4 h-4 accent-yellow-500 rounded focus:ring-yellow-500 cursor-pointer"
                                    />
                                    <div className="flex items-center gap-2 flex-1">
                                        <span className={`text-sm font-bold uppercase tracking-wider ${isSprint ? 'text-yellow-500' : 'text-highlight-silver'}`}>Sprint Weekend</span>
                                    </div>
                                    <SprintIcon className={`w-5 h-5 ${isSprint ? 'text-yellow-500' : 'text-highlight-silver opacity-20'}`} />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Session Times */}
                    <div className="space-y-4 pt-4 border-t border-pure-white/10">
                        <h3 className="text-sm font-bold text-pure-white uppercase tracking-wider mb-2">Session Times (Local/Input)</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 bg-carbon-black/30 p-4 rounded-xl border border-pure-white/5">
                            <TimeInput label="Practice 1" value={getValue(formState.fp1)} onChange={v => handleInputChange('fp1', v)} />
                            
                            {isSprint ? (
                                <>
                                    <TimeInput label="Sprint Qualifying" value={getValue(formState.sprintQualifying)} onChange={v => handleInputChange('sprintQualifying', v)} />
                                    <TimeInput label="Sprint Race" value={getValue(formState.sprint)} onChange={v => handleInputChange('sprint', v)} highlightColor="border-yellow-500/50 text-yellow-500" />
                                    <TimeInput label="Grand Prix Qualifying" value={getValue(formState.qualifying)} onChange={v => handleInputChange('qualifying', v)} />
                                </>
                            ) : (
                                <>
                                    <TimeInput label="Practice 2" value={getValue(formState.fp2)} onChange={v => handleInputChange('fp2', v)} />
                                    <TimeInput label="Practice 3" value={getValue(formState.fp3)} onChange={v => handleInputChange('fp3', v)} />
                                    <TimeInput label="Qualifying" value={getValue(formState.qualifying)} onChange={v => handleInputChange('qualifying', v)} />
                                </>
                            )}
                        </div>

                        <div className="bg-primary-red/5 p-4 rounded-xl border border-primary-red/20 mt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <TimeInput label="Grand Prix Race" value={getValue(formState.race)} onChange={v => handleInputChange('race', v)} highlightColor="text-primary-red font-black" />
                                <TimeInput label="Custom Lock Time (Optional)" value={getValue(formState.customLockAt)} onChange={v => handleInputChange('customLockAt', v)} />
                            </div>
                        </div>
                    </div>

                </form>

                {/* Footer */}
                <div className="p-5 border-t border-pure-white/10 bg-carbon-black/50 flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-bold text-highlight-silver hover:text-pure-white transition-colors bg-transparent border border-accent-gray hover:border-pure-white/50 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-8 py-2 bg-primary-red hover:bg-red-600 text-pure-white font-bold rounded-lg shadow-lg shadow-primary-red/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait transition-all transform hover:scale-105"
                    >
                        {isSaving ? 'Saving...' : <><SaveIcon className="w-4 h-4" /> Save Schedule</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

const TimeInput: React.FC<{ label: string; value: string; onChange: (val: string) => void; highlightColor?: string }> = ({ label, value, onChange, highlightColor }) => (
    <div className="flex flex-col">
        <label className={`text-[10px] font-bold uppercase mb-1.5 ${highlightColor ? highlightColor.split(' ')[0] : 'text-highlight-silver'}`}>{label}</label>
        <input 
            type="datetime-local" 
            value={value}
            onChange={(e) => onChange(e.target.value)} 
            className={`w-full bg-carbon-black border rounded-lg px-3 py-2 text-sm text-pure-white focus:outline-none focus:ring-1 focus:ring-primary-red transition-all ${highlightColor?.includes('border') ? highlightColor : 'border-accent-gray'}`}
        />
    </div>
);

export default ManageSchedulePage;
