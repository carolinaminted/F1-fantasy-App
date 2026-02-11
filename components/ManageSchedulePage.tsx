
import React, { useState, useEffect, useMemo } from 'react';
import { Event, EventSchedule } from '../types.ts';
import { EVENTS } from '../constants.ts';
import { saveEventSchedule } from '../services/firestoreService.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { DownloadIcon } from './icons/DownloadIcon.tsx';
import { SyncIcon } from './icons/SyncIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { db } from '../services/firebase.ts';
import { doc, setDoc } from '@firebase/firestore';

const LEAGUE_TIMEZONE = 'America/New_York';

interface ManageSchedulePageProps {
    setAdminSubPage: (page: 'dashboard' | 'results' | 'manage-users' | 'scoring' | 'entities' | 'schedule' | 'invitations') => void;
    existingSchedules: { [eventId: string]: EventSchedule };
    onScheduleUpdate: () => void;
}

const ManageSchedulePage: React.FC<ManageSchedulePageProps> = ({ setAdminSubPage, existingSchedules, onScheduleUpdate }) => {
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [showImporter, setShowImporter] = useState(false);
    const [importData, setImportData] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
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

    const handleBulkImport = async () => {
        let raw = importData.trim();
        if (!raw) return;

        // Auto-wrap with braces if missing
        if (!raw.startsWith('{')) {
            raw = `{${raw}}`;
        }

        setIsSyncing(true);
        try {
            const parsed = JSON.parse(raw);
            const schedulesRef = doc(db, 'app_state', 'event_schedules');
            
            const newScheduleData: Record<string, EventSchedule> = { ...existingSchedules };
            Object.entries(parsed).forEach(([id, data]: [string, any]) => {
                newScheduleData[id] = {
                    ...newScheduleData[id],
                    ...data,
                    eventId: id
                } as EventSchedule;
            });
            
            await setDoc(schedulesRef, newScheduleData);
            onScheduleUpdate();
            showToast("Firebase records updated successfully!", 'success');
            setShowImporter(false);
            setImportData('');
        } catch (error) {
            console.error("Import error:", error);
            showToast("Invalid format. Ensure you have valid key:value pairs.", 'error');
        } finally {
            setIsSyncing(false);
        }
    };

    const copyTemplate = () => {
        const template = {
            "aus_26": { "fp1": "2026-03-05T20:30", "fp2": "2026-03-06T00:00", "fp3": "2026-03-06T20:30", "qualifying": "2026-03-07T00:00", "race": "2026-03-07T23:00" },
            "chn_26": { "fp1": "2026-03-12T22:30", "sprintQualifying": "2026-03-13T02:30", "sprint": "2026-03-13T22:00", "qualifying": "2026-03-14T02:00", "race": "2026-03-15T02:00", "hasSprint": true }
        };
        navigator.clipboard.writeText(JSON.stringify(template, null, 2));
        showToast("Template copied to clipboard", 'info');
    };

    const selectedEvent = EVENTS.find(e => e.id === editingEventId);

    const DashboardAction = (
        <button 
            onClick={() => setAdminSubPage('dashboard')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">Dashboard</span>
        </button>
    );

    const SyncHeaderAction = (
        <button
            onClick={() => setShowImporter(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest bg-primary-red text-pure-white hover:opacity-90 shadow-lg"
        >
            <SyncIcon className="w-4 h-4" />
            <span>Bulk Import JSON</span>
        </button>
    );

    return (
        <div className="flex flex-col md:h-full md:overflow-hidden w-full max-w-7xl mx-auto text-pure-white">
            <div className="flex-none">
                <PageHeader 
                    title="SCHEDULE MANAGER" 
                    icon={CalendarIcon} 
                    subtitle="Admin: Manage session times in Eastern Time"
                    leftAction={DashboardAction}
                    rightAction={SyncHeaderAction}
                />
            </div>

            <div className="flex-1 md:overflow-y-auto custom-scrollbar px-4 md:px-0 pb-24 md:pb-8 md:min-h-0">
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

            {/* Bulk Importer Modal */}
            {showImporter && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-carbon-black/90 backdrop-blur-md p-4 animate-fade-in" onClick={() => setShowImporter(false)}>
                    <div className="bg-carbon-fiber rounded-xl border border-pure-white/10 shadow-2xl w-full max-w-2xl p-6 flex flex-col gap-4 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <DownloadIcon className="w-5 h-5 text-primary-red" />
                                Database Importer
                            </h2>
                            <button onClick={copyTemplate} className="text-xs font-bold text-highlight-silver hover:text-pure-white bg-pure-white/5 px-2 py-1 rounded">Copy Example Template</button>
                        </div>
                        <p className="text-sm text-highlight-silver">Paste your JSON schedule data below. If you omit the outer braces {`{ }`}, the app will try to add them for you.</p>
                        <textarea 
                            value={importData}
                            onChange={(e) => setImportData(e.target.value)}
                            placeholder='"aus_26": { "race": "2026-03-07T23:00", ... }, ...'
                            className="w-full h-80 bg-carbon-black border border-accent-gray rounded-lg p-4 font-mono text-xs text-pure-white focus:outline-none focus:border-primary-red"
                        />
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setShowImporter(false)} className="px-6 py-2 text-sm font-bold text-highlight-silver">Cancel</button>
                            <button 
                                onClick={handleBulkImport} 
                                disabled={isSyncing || !importData.trim()}
                                className="px-8 py-2 bg-primary-red hover:bg-red-600 text-pure-white font-bold rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50"
                            >
                                {isSyncing ? <SyncIcon className="animate-spin w-4 h-4" /> : <SaveIcon className="w-4 h-4" />}
                                Push to Firebase
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
    const accentColor = isSprint ? '#EAB308' : '#DA291C';

    const displayDate = useMemo(() => {
        const rawDate = schedule?.race;
        if (!rawDate) return 'TBA';
        
        const date = new Date(rawDate);
        if (isNaN(date.getTime())) return 'TBA';
        
        return new Intl.DateTimeFormat('en-US', { 
            month: 'short', 
            day: 'numeric',
            timeZone: LEAGUE_TIMEZONE
        }).format(date);
    }, [schedule]);

    return (
        <button 
            onClick={onClick}
            className="w-full text-left relative overflow-hidden rounded-xl bg-carbon-fiber border border-pure-white/10 hover:border-primary-red/50 shadow-lg hover:shadow-2xl transition-all duration-300 group flex flex-col h-52 items-center justify-center p-6"
        >
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, transparent 80%)` }}></div>
            {isSprint && (
                <div className="absolute top-4 left-4 z-20">
                    <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-1 rounded border border-yellow-500/30 font-black uppercase tracking-widest">
                        <SprintIcon className="w-3 h-3 text-yellow-500" /> Sprint
                    </div>
                </div>
            )}
            <div className="absolute top-4 right-4">
                {hasData ? (
                    <span className="w-2.5 h-2.5 block rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></span>
                ) : (
                    <span className="w-2.5 h-2.5 block rounded-full bg-highlight-silver/20 border border-pure-white/10"></span>
                )}
            </div>
            <div className="relative z-10 flex flex-col items-center text-center">
                <span className="text-[10px] font-bold text-highlight-silver uppercase tracking-[0.2em] mb-1">Round {event.round}</span>
                <h3 className="text-2xl font-black text-pure-white leading-none mb-2 tracking-tight">
                    {schedule?.name || event.name}
                </h3>
                <p className="text-xs font-medium text-highlight-silver opacity-80 uppercase tracking-wider mb-4">
                    {event.location}, {event.country}
                </p>
                <div className={`text-[11px] font-black text-pure-white px-3 py-1 rounded bg-carbon-black/80 border border-pure-white/10 shadow-lg tracking-widest uppercase ${!hasData ? 'opacity-30' : ''}`}>
                    {displayDate}
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

                <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                    <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-xl flex items-start gap-4 mb-4">
                        <div className="bg-blue-500 p-2 rounded-lg text-white"><CalendarIcon className="w-5 h-5" /></div>
                        <div>
                            <h4 className="text-sm font-bold text-white uppercase">League Timezone Active: EST/EDT</h4>
                            <p className="text-xs text-highlight-silver mt-0.5">Please enter all session times as they should appear for the New York audience.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-highlight-silver uppercase mb-1.5">Custom Name</label>
                            <input 
                                type="text" 
                                value={formState.name !== undefined ? formState.name : event.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                className="w-full bg-carbon-black border border-accent-gray rounded-lg px-3 py-2 text-sm text-pure-white focus:outline-none focus:border-primary-red"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-highlight-silver uppercase mb-1.5 opacity-0">Format</label>
                            <label className={`flex items-center gap-3 px-3 py-1.5 rounded-lg border transition-all cursor-pointer h-[38px] ${isSprint ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-carbon-black border-accent-gray'}`}>
                                <input type="checkbox" checked={!!isSprint} onChange={(e) => handleInputChange('hasSprint', e.target.checked)} className="w-4 h-4 accent-yellow-500" />
                                <span className={`text-sm font-bold uppercase ${isSprint ? 'text-yellow-500' : 'text-highlight-silver'}`}>Sprint Weekend</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-pure-white/10">
                        <h3 className="text-sm font-bold text-pure-white uppercase tracking-wider mb-2">Session Timetable <span className="text-primary-red">(EST)</span></h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 bg-carbon-black/30 p-4 rounded-xl border border-pure-white/5">
                            <TimeInput label="Practice 1" value={getValue(formState.fp1)} onChange={v => handleInputChange('fp1', v)} />
                            {isSprint ? (
                                <>
                                    <TimeInput label="Sprint Qualifying" value={getValue(formState.sprintQualifying)} onChange={v => handleInputChange('sprintQualifying', v)} />
                                    <TimeInput label="Sprint Race" value={getValue(formState.sprint)} onChange={v => handleInputChange('sprint', v)} highlightColor="border-yellow-500/50 text-yellow-500" />
                                    <TimeInput label="Qualifying" value={getValue(formState.qualifying)} onChange={v => handleInputChange('qualifying', v)} />
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
                                <TimeInput label="Custom Lock Time" value={getValue(formState.customLockAt)} onChange={v => handleInputChange('customLockAt', v)} />
                            </div>
                        </div>
                    </div>
                </form>

                <div className="p-5 border-t border-pure-white/10 bg-carbon-black/50 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-6 py-2 text-sm font-bold text-highlight-silver hover:text-pure-white border border-accent-gray rounded-lg">Cancel</button>
                    <button onClick={handleSave} disabled={isSaving} className="px-8 py-2 bg-primary-red hover:bg-red-600 text-pure-white font-bold rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50">
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
