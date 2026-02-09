
import React, { useState, useMemo, useEffect } from 'react';
import { RaceResults, Event, EventResult, Driver, PointsSystem, Constructor, AdminLogEntry } from '../types.ts';
import ResultsForm from './ResultsForm.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { HistoryIcon } from './icons/HistoryIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { useToast } from '../contexts/ToastContext.tsx';
import { logAdminAction, getAdminLogs } from '../services/firestoreService.ts';
import { EventSelector } from './ui/EventSelector.tsx';

interface ResultsManagerPageProps {
    raceResults: RaceResults;
    onResultsUpdate: (eventId: string, results: EventResult) => Promise<void>;
    setAdminSubPage: (page: 'dashboard') => void;
    allDrivers: Driver[];
    allConstructors: Constructor[];
    formLocks: { [eventId: string]: boolean };
    onToggleLock: (eventId: string) => void;
    activePointsSystem: PointsSystem;
    events: Event[];
    adminId: string;
    adminName: string;
}

const ResultsManagerPage: React.FC<ResultsManagerPageProps> = ({ raceResults, onResultsUpdate, setAdminSubPage, allDrivers, allConstructors, formLocks, onToggleLock, activePointsSystem, events, adminId, adminName }) => {
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const { showToast } = useToast();
    
    // Log Viewer State
    const [showLogModal, setShowLogModal] = useState(false);
    const [auditLogs, setAuditLogs] = useState<AdminLogEntry[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);

    // Reset Confirmation State
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    const checkHasResults = (event: Event): boolean => {
        const results = raceResults[event.id];
        if (!results) return false;
        const hasGpFinish = results.grandPrixFinish?.some(pos => !!pos);
        const hasFastestLap = !!results.fastestLap;
        const hasSprintFinish = results.sprintFinish?.some(pos => !!pos);
        const hasGpQuali = results.gpQualifying?.some(pos => !!pos);
        const hasSprintQuali = results.sprintQualifying?.some(pos => !!pos);
        return hasGpFinish || hasFastestLap || hasSprintFinish || hasGpQuali || hasSprintQuali;
    };

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

    const DashboardAction = (
        <button 
            onClick={() => setAdminSubPage('dashboard')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">Dashboard</span>
        </button>
    );

    const HistoryAction = (
        <button 
            onClick={fetchLogs}
            disabled={!selectedEventId}
            className={`flex items-center gap-2 transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30 ${!selectedEventId ? 'opacity-50 cursor-not-allowed text-highlight-silver' : 'text-pure-white hover:bg-carbon-black/80'}`}
        >
            <HistoryIcon className="w-4 h-4" />
            <span className="text-sm font-bold hidden sm:inline">History</span>
        </button>
    );

    // Dropdown Filters Logic
    const handleEventFilter = (event: Event, filter: string) => {
        const hasResults = checkHasResults(event);
        if (filter === 'added') return hasResults;
        if (filter === 'pending') return !hasResults;
        return true;
    };

    const renderEventStatus = (event: Event) => {
        const hasResults = checkHasResults(event);
        const isLocked = formLocks[event.id];
        
        return (
            <div className="flex items-center gap-2">
                {isLocked && <span className="text-[9px] text-primary-red border border-primary-red/50 rounded px-1 font-bold uppercase">Locked</span>}
                {hasResults && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>}
            </div>
        );
    };

    return (
        <div className="flex flex-col w-full max-w-7xl mx-auto text-pure-white min-h-full">
            <div className="flex-none">
                <PageHeader 
                    title="RESULTS MANAGER" 
                    icon={TrackIcon} 
                    leftAction={DashboardAction}
                    rightAction={HistoryAction}
                />
            </div>
            
            <div className="flex flex-col px-4 md:px-0">
                {/* Control Bar with Event Selector */}
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-xl p-3 md:p-4 mb-4 md:mb-6 ring-1 ring-pure-white/10 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-end flex-shrink-0 shadow-lg">
                    
                    <div className="w-full md:w-auto flex-grow flex justify-end">
                        <EventSelector 
                            events={events}
                            selectedEventId={selectedEventId}
                            onSelect={(e) => setSelectedEventId(e.id)}
                            filters={[
                                { label: 'All Rounds', value: 'all' },
                                { label: 'Done', value: 'added' },
                                { label: 'Pending', value: 'pending' }
                            ]}
                            filterPredicate={handleEventFilter}
                            renderStatus={renderEventStatus}
                            placeholder="Select GP Weekend..."
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
                            />
                            
                            <div className="mt-6 pt-4 border-t border-pure-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-highlight-silver opacity-50 text-center md:text-left">
                                    Recalculation engine triggers automatically upon saving.
                                </p>
                                <button
                                    onClick={handleInitiateReset}
                                    className="flex items-center gap-2 text-[10px] font-bold text-red-500 hover:text-red-400 uppercase tracking-widest transition-colors px-3 py-2 rounded hover:bg-red-900/10 border border-transparent hover:border-red-500/20"
                                    title="Reset all results for this event"
                                >
                                    <TrashIcon className="w-4 h-4" /> Reset Event Results
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 md:h-96 bg-accent-gray/20 rounded-xl border-2 border-dashed border-accent-gray/50 m-2">
                            <TrackIcon className="w-16 h-16 text-accent-gray mb-6 opacity-20" />
                            <h3 className="text-xl font-bold text-highlight-silver mb-2">Awaiting Race Telemetry</h3>
                            <p className="text-highlight-silver/50 text-sm max-w-xs text-center">Select an event from the roster above to manage session results and lock statuses.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Audit Log Modal */}
            {showLogModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowLogModal(false)}>
                    <div className="bg-carbon-fiber border border-pure-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-pure-white/10 flex justify-between items-center bg-carbon-black/50 rounded-t-xl">
                            <div className="flex items-center gap-2">
                                <HistoryIcon className="w-5 h-5 text-primary-red" />
                                <h3 className="text-lg font-bold text-pure-white">Audit Trail: {selectedEvent?.name}</h3>
                            </div>
                            <button onClick={() => setShowLogModal(false)} className="text-highlight-silver hover:text-pure-white text-2xl leading-none">&times;</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                            {isLoadingLogs ? (
                                <div className="p-8 text-center text-highlight-silver italic">Loading history...</div>
                            ) : auditLogs.length === 0 ? (
                                <div className="p-8 text-center text-highlight-silver italic">No history found for this event.</div>
                            ) : (
                                <div className="divide-y divide-pure-white/5">
                                    {auditLogs.map(log => {
                                        const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                                        return (
                                            <div key={log.id} className="p-4 hover:bg-pure-white/5 transition-colors">
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-bold text-pure-white text-sm">{log.adminName}</span>
                                                    <span className="text-xs text-highlight-silver font-mono">{date.toLocaleString()}</span>
                                                </div>
                                                <div className="text-xs text-primary-red font-bold uppercase tracking-wider mb-1">{log.action}</div>
                                                <p className="text-sm text-highlight-silver whitespace-pre-wrap leading-relaxed">{log.changes}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reset Confirmation Modal */}
            {showResetConfirm && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-carbon-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowResetConfirm(false)}>
                    <div className="bg-carbon-fiber border border-red-500 rounded-xl p-6 md:p-8 max-w-md w-full text-center shadow-2xl shadow-red-900/50 ring-1 ring-red-500/30 animate-scale-in" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/50">
                            <TrashIcon className="w-8 h-8 text-red-500" />
                        </div>
                        
                        <h2 className="text-2xl font-bold text-pure-white mb-2">Reset Results?</h2>
                        <p className="text-highlight-silver mb-6 text-sm leading-relaxed">
                            You are about to clear all race data for <span className="text-pure-white font-bold">{selectedEvent?.name}</span>.
                            <br/><br/>
                            This will remove P1-P10, Quali, Sprint, and Fastest Lap records. Scores will be recalculated to 0 for this event.
                            <br/><br/>
                            <span className="text-red-400 font-bold uppercase tracking-wide">This action cannot be undone.</span>
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleConfirmReset}
                                className="w-full bg-red-600 hover:bg-red-500 text-pure-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg shadow-red-600/20 uppercase tracking-widest text-xs"
                            >
                                Yes, Reset Everything
                            </button>
                            <button
                                onClick={() => setShowResetConfirm(false)}
                                className="w-full bg-transparent hover:bg-pure-white/5 text-highlight-silver font-bold py-3 px-6 rounded-lg transition-colors border border-transparent hover:border-pure-white/10 uppercase text-xs"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultsManagerPage;
