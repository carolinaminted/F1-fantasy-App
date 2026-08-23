
import React, { useState, useMemo, useEffect } from 'react';
import { RaceResults, Event, EventResult, Driver, PointsSystem, Constructor, AdminLogEntry } from '../types.ts';
import ResultsForm from './ResultsForm.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { HistoryIcon } from './icons/HistoryIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { logAdminAction, getAdminLogs, cancelEvent, uncancelEvent } from '../services/firestoreService.ts';
import {
    EventSelector, Tile, Modal, Chip, EmptyState, NUMERIC,
} from './ui/index.ts';
import { AdminToolShell, ConfirmModal } from './admin/index.ts';
import { XCircleIcon } from './icons/XCircleIcon.tsx';
import { RotateCcwIcon } from './icons/RotateCcwIcon.tsx';
import type { AdminDestination } from '../routes.ts';
import { hasEventResults } from '../utils/eventStatus.ts';

interface ResultsManagerPageProps {
    raceResults: RaceResults;
    onResultsUpdate: (eventId: string, results: EventResult) => Promise<void>;
    setAdminSubPage: (page: AdminDestination) => void;
    allDrivers: Driver[];
    allConstructors: Constructor[];
    formLocks: { [eventId: string]: boolean };
    onToggleLock: (eventId: string) => void;
    activePointsSystem: PointsSystem;
    events: Event[];
    adminId: string;
    adminName: string;
    cancelledEventIds: Set<string>;
}

const ResultsManagerPage: React.FC<ResultsManagerPageProps> = ({ raceResults, onResultsUpdate, setAdminSubPage, allDrivers, allConstructors, formLocks, onToggleLock, activePointsSystem, events, adminId, adminName, cancelledEventIds }) => {
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const { showToast } = useToast();
    
    // Log Viewer State
    const [showLogModal, setShowLogModal] = useState(false);
    const [auditLogs, setAuditLogs] = useState<AdminLogEntry[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // Reset Confirmation State
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Cancel Confirmation State
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    // Restore Confirmation State
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

    const checkHasResults = (event: Event): boolean => hasEventResults(raceResults[event.id]);

    const generateDiff = (oldR: EventResult, newR: EventResult): string => {
        const changes: string[] = [];

        const getName = (id: string | null) => {
            if (!id) return 'Empty';
            const driver = allDrivers.find(d => d.id === id);
            return driver ? driver.name : id;
        };

        // Check Fastest Lap
        if (oldR.fastestLap !== newR.fastestLap) {
            changes.push(`Fastest Lap: ${getName(oldR.fastestLap)} → ${getName(newR.fastestLap)}`);
        }

        // Check Array Comparators
        const checkArray = (label: string, oldArr: (string|null)[] | undefined, newArr: (string|null)[] | undefined) => {
            if (!newArr) return;
            const oldSafe = oldArr || [];
            
            // Detect purely new entry vs edits
            const wasEmpty = oldSafe.every(x => !x);
            const isNowEmpty = newArr.every(x => !x);

            if (wasEmpty && !isNowEmpty) {
                changes.push(`Entered ${label} Results`);
                return;
            }
            
            const diffs: string[] = [];
            newArr.forEach((newVal, idx) => {
                const oldVal = oldSafe[idx] || null;
                if (oldVal !== newVal) {
                    diffs.push(`P${idx + 1}: ${getName(oldVal)}→${getName(newVal)}`);
                }
            });

            if (diffs.length > 0) {
                changes.push(`${label}: ${diffs.join(', ')}`);
            }
        };

        checkArray('GP', oldR.grandPrixFinish, newR.grandPrixFinish);
        checkArray('GP Quali', oldR.gpQualifying, newR.gpQualifying);
        checkArray('Sprint', oldR.sprintFinish, newR.sprintFinish);
        checkArray('Sprint Quali', oldR.sprintQualifying, newR.sprintQualifying);
        
        if (changes.length === 0) return "No visible changes (Save Triggered)";
        return changes.join("; ");
    };

    const handleSave = async (eventId: string, results: EventResult): Promise<boolean> => {
        try {
            const event = events.find(e => e.id === eventId);
            const currentRes = raceResults[eventId] || { 
                grandPrixFinish: [], gpQualifying: [], fastestLap: null, p22Driver: null
            };

            const changeSummary = generateDiff(currentRes, results);

            // Snapshot 1: Driver Teams (Existing)
            const driverTeamsSnapshot: { [driverId: string]: string } = {};
            allDrivers.forEach(d => {
                driverTeamsSnapshot[d.id] = d.constructorId;
            });

            // Snapshot 2: Scoring Rules (New)
            const resultsWithSnapshot = {
                ...results,
                driverTeams: driverTeamsSnapshot,
                scoringSnapshot: activePointsSystem,
            };

            await onResultsUpdate(eventId, resultsWithSnapshot);
            
            // Audit Logging
            await logAdminAction({
                adminId,
                adminName,
                eventId,
                eventName: event?.name || eventId,
                action: currentRes.grandPrixFinish?.length ? 'update' : 'create',
                changes: changeSummary
            });

            showToast(`Results for ${eventId} saved successfully!`, 'success');
            return true;
        } catch (error) {
            showToast(`Error: Could not update results for ${eventId}.`, 'error');
            return false;
        }
    };

    const handleInitiateReset = () => {
        if (!selectedEvent) return;
        setShowResetConfirm(true);
    };

    const handleConfirmReset = async () => {
        if (!selectedEvent) return;
        
        const emptyRes: EventResult = {
            grandPrixFinish: Array(10).fill(null),
            gpQualifying: Array(3).fill(null),
            fastestLap: null,
            p22Driver: null,
            ...(selectedEvent.hasSprint && {
                sprintFinish: Array(8).fill(null),
                sprintQualifying: Array(3).fill(null),
            }),
        };

        const success = await handleSave(selectedEvent.id, emptyRes);
        if (success) {
            showToast(`Results reset for ${selectedEvent.name}.`, 'success');
        }
        setShowResetConfirm(false);
    };

    const fetchLogs = async () => {
        if (!selectedEventId) return;
        setIsLoadingLogs(true);
        setShowLogModal(true);
        const logs = await getAdminLogs(selectedEventId);
        setAuditLogs(logs);
        setIsLoadingLogs(false);
    };

    const selectedEvent = useMemo(() => events.find(event => event.id === selectedEventId), [selectedEventId, events]);

    const isCancelled = selectedEvent ? cancelledEventIds.has(selectedEvent.id) : false;

    const handleCancelEvent = () => {
        if (!selectedEvent) return;
        setCancelReason('');
        setShowCancelConfirm(true);
    };

    const confirmCancelEvent = async () => {
        if (!selectedEvent) return;
        
        setShowCancelConfirm(false);
        try {
            setIsSaving(true);
            await cancelEvent(selectedEvent.id, adminId, cancelReason);
            await logAdminAction({
                adminId: adminId,
                adminName: adminName,
                action: 'CANCEL_EVENT',
                eventId: selectedEvent.id,
                eventName: selectedEvent.name,
                changes: `Event cancelled. Reason: ${cancelReason || 'No reason provided'}`
            });
            showToast('Event cancelled successfully', 'success');
        } catch (error) {
            console.error("Error cancelling event:", error);
            showToast('Failed to cancel event', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRestoreEvent = () => {
        if (!selectedEvent) return;
        setShowRestoreConfirm(true);
    };

    const confirmRestoreEvent = async () => {
        if (!selectedEvent) return;
        setShowRestoreConfirm(false);

        try {
            setIsSaving(true);
            await uncancelEvent(selectedEvent.id);
            await logAdminAction({
                adminId: adminId,
                adminName: adminName,
                action: 'RESTORE_EVENT',
                eventId: selectedEvent.id,
                eventName: selectedEvent.name,
                changes: 'Event restored from cancelled state'
            });
            showToast('Event restored successfully', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to restore event', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const HistoryAction = (
        <button 
            onClick={fetchLogs}
            disabled={!selectedEventId}
            className={`flex items-center gap-2 transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30 ${!selectedEventId ? 'opacity-50 cursor-not-allowed text-highlight-silver' : 'text-pure-white hover:bg-carbon-black/80'}`}
        >
            <HistoryIcon className="w-4 h-4" />
            <span className="text-sm font-bold hidden sm:inline">Change history</span>
        </button>
    );

    const renderEventStatus = (event: Event) => {
        const hasResults = checkHasResults(event);
        const isLocked = formLocks[event.id];
        const isEventCancelled = cancelledEventIds.has(event.id);
        
        return (
            <div className="flex items-center gap-2">
                {isEventCancelled && <Chip label="Cancelled" tone="danger" size="xs" />}
                {isLocked && !isEventCancelled && <Chip label="Picks closed" tone="warning" size="xs" />}
                {hasResults && <Chip label="Scored" tone="success" size="xs" />}
            </div>
        );
    };

    return (
        <div className="flex flex-col w-full max-w-7xl mx-auto text-pure-white min-h-full">
            <AdminToolShell
                title="RACE RESULTS"
                icon={TrackIcon}
                subtitle="Enter finishing positions and open or close the pick form"
                setAdminSubPage={setAdminSubPage}
                actions={HistoryAction}
            />

            <div className="flex flex-col px-4 md:px-0">
                {/* Control Bar with Event Selector */}
                <div className="relative z-30 bg-accent-gray/50 backdrop-blur-sm rounded-xl p-3 md:p-4 mb-4 md:mb-6 ring-1 ring-pure-white/10 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-end shrink-0 shadow-lg">
                    
                    <div className="w-full md:w-auto grow flex justify-end">
                        <EventSelector 
                            events={events}
                            selectedEventId={selectedEventId}
                            onSelect={(e) => setSelectedEventId(e.id)}
                            raceResults={raceResults}
                            cancelledEventIds={cancelledEventIds}
                            orderBy="upcoming-first"
                            align="right"
                            renderStatus={renderEventStatus}
                            placeholder="Choose a race…"
                        />
                    </div>
                </div>

                {/* Main Form Area - Expanded natural height, no internal desktop scroll */}
                <div className="w-full max-w-6xl mx-auto pb-32 md:pb-12">
                    {selectedEvent ? (
                        <div className="bg-carbon-fiber rounded-xl p-4 md:p-6 border border-pure-white/10 shadow-2xl flex flex-col mb-4">
                            <ResultsForm
                                event={selectedEvent}
                                currentResults={raceResults[selectedEvent.id]}
                                onSave={handleSave}
                                allDrivers={allDrivers}
                                allConstructors={allConstructors}
                                isLocked={!!formLocks[selectedEvent.id]}
                                onToggleLock={() => onToggleLock(selectedEvent.id)}
                                isCancelled={isCancelled}
                            />

                            <p className="mt-6 pt-4 border-t border-pure-white/5 text-[11px] text-highlight-silver">
                                Saving updates everyone's scores automatically.
                            </p>

                            {/*
                              These two actions used to sit side by side in the same red, which
                              made the reversible one look as frightening as the permanent one.
                              Cancelling a race can be undone; deleting its results cannot, so
                              they are separated and toned apart.
                            */}
                            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-stretch">
                                <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl border border-pure-white/10 bg-carbon-black/40 p-4">
                                    <div>
                                        <h4 className="text-sm font-bold text-pure-white">
                                            {isCancelled ? 'This race is cancelled' : 'Cancel this race'}
                                        </h4>
                                        <p className="mt-1 text-[11px] leading-relaxed text-highlight-silver">
                                            A cancelled race doesn't count towards anyone's score or their
                                            selection limits. You can bring it back at any time.
                                        </p>
                                    </div>
                                    {isCancelled ? (
                                        <button
                                            type="button"
                                            onClick={handleRestoreEvent}
                                            disabled={isSaving}
                                            className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-green-500 disabled:opacity-50"
                                        >
                                            <RotateCcwIcon className="w-4 h-4" /> Bring this race back
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleCancelEvent}
                                            disabled={isSaving}
                                            className="flex items-center justify-center gap-2 rounded-lg border border-pure-white/15 bg-pure-white/5 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-pure-white/10 disabled:opacity-50"
                                        >
                                            <XCircleIcon className="w-4 h-4" /> Cancel this race
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl border border-primary-red/30 bg-primary-red/[0.06] p-4">
                                    <div>
                                        <h4 className="text-sm font-bold text-primary-red">Delete the results</h4>
                                        <p className="mt-1 text-[11px] leading-relaxed text-highlight-silver">
                                            Clears every position you've entered for this race and sets
                                            everyone's score for it back to zero. This can't be undone.
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleInitiateReset}
                                        className="flex items-center justify-center gap-2 rounded-lg border border-primary-red/40 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-primary-red transition-colors hover:bg-primary-red hover:text-pure-white"
                                    >
                                        <TrashIcon className="w-4 h-4" /> Delete results
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <Tile padding="none">
                            <EmptyState
                                icon={TrackIcon}
                                title="Choose a race to get started"
                                description="Pick a race above to type in its finishing positions, or to open and close the pick form for it."
                            />
                        </Tile>
                    )}
                </div>
            </div>

            <Modal
                isOpen={showLogModal}
                onClose={() => setShowLogModal(false)}
                title={`Change history — ${selectedEvent?.name ?? ''}`}
                icon={HistoryIcon}
                size="lg"
            >
                {isLoadingLogs ? (
                    <p className="py-8 text-center italic text-highlight-silver">Loading…</p>
                ) : auditLogs.length === 0 ? (
                    <p className="py-8 text-center italic text-highlight-silver">
                        Nobody has changed the results for this race yet.
                    </p>
                ) : (
                    <div className="divide-y divide-pure-white/5">
                        {auditLogs.map(log => {
                            const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                            return (
                                <div key={log.id} className="py-3 first:pt-0">
                                    <div className="mb-1 flex items-start justify-between gap-3">
                                        <span className="text-sm font-bold text-pure-white">{log.adminName}</span>
                                        <span className={`text-xs text-highlight-silver ${NUMERIC}`}>
                                            {date.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-primary-red">
                                        {log.action}
                                    </div>
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-highlight-silver">
                                        {log.changes}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Modal>

            <ConfirmModal
                isOpen={showResetConfirm}
                onClose={() => setShowResetConfirm(false)}
                onConfirm={handleConfirmReset}
                title="Delete the results for this race"
                consequence={
                    <>
                        This clears every position entered for{' '}
                        <strong className="text-pure-white">{selectedEvent?.name}</strong> — the top ten,
                        qualifying, sprint and fastest lap — and sets everyone's score for this race back
                        to zero. You would have to type them all in again. This cannot be undone.
                    </>
                }
                confirmLabel="Delete results"
            />

            <ConfirmModal
                isOpen={showCancelConfirm}
                onClose={() => setShowCancelConfirm(false)}
                onConfirm={confirmCancelEvent}
                title="Cancel this race"
                tone="warning"
                consequence={
                    <>
                        <strong className="text-pure-white">{selectedEvent?.name}</strong> stops counting
                        towards anyone's score and towards their driver and team selection limits. You can
                        bring it back at any time.
                    </>
                }
                confirmLabel="Cancel this race"
                cancelLabel="Go back"
            >
                <label className="block text-[11px] font-bold uppercase tracking-wider text-highlight-silver">
                    Reason (optional)
                </label>
                <input
                    type="text"
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    placeholder="e.g. Extreme weather"
                    className="mt-1.5 w-full rounded-lg border border-pure-white/15 bg-carbon-black px-3 py-2 text-sm text-pure-white focus:border-primary-red focus:outline-none"
                />
            </ConfirmModal>

            <ConfirmModal
                isOpen={showRestoreConfirm}
                onClose={() => setShowRestoreConfirm(false)}
                onConfirm={confirmRestoreEvent}
                title="Bring this race back"
                tone="info"
                consequence={
                    <>
                        <strong className="text-pure-white">{selectedEvent?.name}</strong> starts counting
                        towards scores and selection limits again.
                    </>
                }
                confirmLabel="Bring it back"
            />
        </div>
    );
};

export default ResultsManagerPage;
