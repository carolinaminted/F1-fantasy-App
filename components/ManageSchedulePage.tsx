
import React, { useState, useEffect, useMemo } from 'react';
import { Event, EventSchedule } from '../types.ts';
import { EVENTS } from '../constants.ts';
import { saveEventSchedule } from '../services/firestoreService.ts';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { SyncIcon } from './icons/SyncIcon.tsx';
import { Tile, Modal, Chip, Banner, NUMERIC } from './ui/index.ts';
import { AdminToolShell, ConfirmModal } from './admin/index.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import { db } from '../services/firebase.ts';
import { doc, setDoc } from '@firebase/firestore';
import { parseLeagueDate } from '../utils/dateUtils.ts';
import type { AdminDestination } from '../routes.ts';

const LEAGUE_TIMEZONE = 'America/New_York';

interface ManageSchedulePageProps {
    setAdminSubPage: (page: AdminDestination) => void;
    existingSchedules: { [eventId: string]: EventSchedule };
    onScheduleUpdate: () => void;
}

const ManageSchedulePage: React.FC<ManageSchedulePageProps> = ({ setAdminSubPage, existingSchedules, onScheduleUpdate }) => {
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [showImporter, setShowImporter] = useState(false);
    const [importData, setImportData] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [showImportConfirm, setShowImportConfirm] = useState(false);
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
        setShowImportConfirm(false);
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
            showToast("Schedule updated.", 'success');
            setShowImporter(false);
            setImportData('');
        } catch (error) {
            console.error("Import error:", error);
            showToast("That does not look like valid schedule data. Nothing was changed.", 'error');
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

    return (
        <div className="flex flex-col md:h-full md:overflow-hidden w-full max-w-7xl mx-auto text-pure-white">
            <AdminToolShell
                title="RACE SCHEDULE"
                icon={CalendarIcon}
                subtitle="All times are Eastern (New York)"
                setAdminSubPage={setAdminSubPage}
                actions={
                    <button
                        onClick={() => setShowImporter(true)}
                        className="flex items-center gap-2 rounded-lg border border-pure-white/15 bg-carbon-black/60 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-highlight-silver transition-colors hover:border-pure-white/30 hover:text-pure-white"
                    >
                        <SyncIcon className="w-4 h-4" />
                        <span>Import full schedule</span>
                    </button>
                }
            />

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

            <Modal
                isOpen={showImporter}
                onClose={() => !isSyncing && setShowImporter(false)}
                title="Import a full schedule"
                icon={SyncIcon}
                size="lg"
                footer={
                    <>
                        <button
                            onClick={() => setShowImporter(false)}
                            disabled={isSyncing}
                            className="rounded-lg border border-pure-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-highlight-silver transition-colors hover:text-pure-white disabled:opacity-40"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => setShowImportConfirm(true)}
                            disabled={isSyncing || !importData.trim()}
                            className="flex items-center gap-2 rounded-lg bg-primary-red px-4 py-2 text-xs font-black uppercase tracking-wider text-pure-white transition-colors hover:bg-red-600 disabled:opacity-40"
                        >
                            {isSyncing ? <SyncIcon className="w-4 h-4 animate-spin" /> : <SaveIcon className="w-4 h-4" />}
                            Review and replace
                        </button>
                    </>
                }
            >
                <Banner
                    tone="warning"
                    title="This replaces the times for every race at once"
                    message="Use the editor on a race card instead if you only need to change one weekend."
                    className="-mx-6 -mt-6 mb-4 rounded-none"
                />
                <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-highlight-silver">
                        Paste schedule data below. An example is a faster starting point than typing it.
                    </p>
                    <button
                        onClick={copyTemplate}
                        className="shrink-0 rounded border border-pure-white/10 bg-pure-white/5 px-2 py-1 text-[11px] font-bold text-highlight-silver transition-colors hover:text-pure-white"
                    >
                        Copy an example
                    </button>
                </div>
                <textarea
                    value={importData}
                    onChange={e => setImportData(e.target.value)}
                    placeholder='"aus_26": { "race": "2026-03-07T23:00", ... }, ...'
                    className={`h-72 w-full rounded-lg border border-pure-white/15 bg-carbon-black p-4 text-xs text-pure-white focus:border-primary-red focus:outline-none ${NUMERIC}`}
                />
            </Modal>

            <ConfirmModal
                isOpen={showImportConfirm}
                onClose={() => setShowImportConfirm(false)}
                onConfirm={handleBulkImport}
                title="Replace the schedule"
                consequence="This overwrites the saved session times for every race in the season with what you pasted. Any race you did not include keeps its current times. There is no undo, so make sure the data is right."
                confirmLabel="Replace schedule"
                busy={isSyncing}
                busyLabel="Replacing..."
            />

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

    const displayDate = useMemo(() => {
        const rawDate = schedule?.race;
        if (!rawDate) return 'TBA';
        
        const date = parseLeagueDate(rawDate);
        if (!date || isNaN(date.getTime())) return 'TBA';
        
        return new Intl.DateTimeFormat('en-US', { 
            month: 'short', 
            day: 'numeric',
            timeZone: LEAGUE_TIMEZONE
        }).format(date);
    }, [schedule]);

    return (
        <Tile padding="md" onClick={onClick} className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-highlight-silver">
                    Round {event.round}
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                    {isSprint && <Chip label="Sprint" tone="warning" size="xs" icon={SprintIcon} />}
                    <Chip
                        label={hasData ? 'Times set' : 'No times yet'}
                        tone={hasData ? 'success' : 'neutral'}
                        size="xs"
                    />
                </div>
            </div>

            <div className="mt-3">
                <h3 className="text-lg font-black leading-tight tracking-tight text-pure-white">
                    {schedule?.name || event.name}
                </h3>
                <p className="mt-0.5 text-[11px] uppercase tracking-wider text-highlight-silver">
                    {event.location}, {event.country}
                </p>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
                <span className={`text-sm font-black text-pure-white ${NUMERIC} ${hasData ? '' : 'opacity-40'}`}>
                    {displayDate}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-highlight-silver">Race day</span>
            </div>
        </Tile>
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
                        <p className="text-xs text-highlight-silver mt-1">
                            {event.country} &bull; {event.circuit} &bull; all times Eastern
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-pure-white/10 rounded-full text-highlight-silver hover:text-pure-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-bold text-highlight-silver uppercase tracking-wider mb-1.5">Race name</label>
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
                                <span className={`text-sm font-bold uppercase ${isSprint ? 'text-yellow-500' : 'text-highlight-silver'}`}>Sprint weekend</span>
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-pure-white/10">
                        <h3 className="text-sm font-bold text-pure-white uppercase tracking-wider mb-2">Session times</h3>
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
                                <div>
                                    <TimeInput
                                        label="Picks deadline (optional)"
                                        value={getValue(formState.customLockAt)}
                                        onChange={v => handleInputChange('customLockAt', v)}
                                    />
                                    <p className="mt-1.5 text-[11px] leading-relaxed text-highlight-silver">
                                        When members stop being able to change their picks. Leave blank and
                                        it defaults to {isSprint ? 'sprint qualifying' : 'qualifying'}.
                                    </p>
                                </div>
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
