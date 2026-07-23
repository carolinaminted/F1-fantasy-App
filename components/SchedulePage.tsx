import React, { useState, useMemo } from 'react';
import { Event, EventSchedule, RaceResults } from '../types.ts';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { CircuitRoute } from './icons/CircuitRoutes.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { Page } from '../App.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { parseLeagueDate, LEAGUE_TIMEZONE } from '../utils/dateUtils.ts';

interface SchedulePageProps {
    schedules: { [eventId: string]: EventSchedule };
    events: Event[];
    onRefresh?: () => Promise<void>;
    raceResults?: RaceResults;
    setActivePage: (page: Page) => void;
    cancelledEventIds: Set<string>;
}

/**
 * Robust formatting helpers to ensure the day and time are calculated 
 * strictly in the league timezone (EST/EDT).
 */
const formatSessionDate = (isoString?: string) => {
    const date = parseLeagueDate(isoString);
    if (!date) return 'TBA';
    
    return new Intl.DateTimeFormat('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        timeZone: LEAGUE_TIMEZONE
    }).format(date);
};

const formatSessionTime = (isoString?: string) => {
    const date = parseLeagueDate(isoString);
    if (!date) return '-';
    
    return new Intl.DateTimeFormat('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: LEAGUE_TIMEZONE
    }).format(date);
};

// Fix: Add hexToRgba helper function to resolve "Cannot find name 'hexToRgba'" errors.
const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const SchedulePage: React.FC<SchedulePageProps> = ({ schedules, events, onRefresh, raceResults, setActivePage, cancelledEventIds }) => {
    const [viewMode, setViewMode] = useState<'upcoming' | 'full'>('upcoming');
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRetry = async () => {
        if (!onRefresh) return;
        setIsRefreshing(true);
        try {
            await onRefresh();
        } finally {
            setIsRefreshing(false);
        }
    };

    const nextRace = useMemo(() => {
        const now = new Date();
        return events.find(e => {
            const sched = schedules[e.id];
            // Priority: admin scheduled time, else static constant
            const raceRaw = sched?.race || e.lockAtUtc;
            const raceTime = parseLeagueDate(raceRaw);
            if (!raceTime) return false;
            
            const raceEndTime = new Date(raceTime.getTime() + 2 * 60 * 60 * 1000); 
            return raceEndTime > now;
        });
    }, [schedules, events]);

    const upcomingRaces = useMemo(() => {
        if (!nextRace) return [];
        const idx = events.findIndex(e => e.id === nextRace.id);
        return events.slice(idx, idx + 5);
    }, [nextRace, events]);

    const RightAction = (
        <div className="flex flex-col items-center md:items-end gap-2">
            <div className="flex bg-accent-gray rounded-lg p-1 shadow-lg">
                <button
                    onClick={() => setViewMode('upcoming')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${viewMode === 'upcoming' ? 'bg-primary-red text-pure-white shadow-sm' : 'text-highlight-silver hover:text-pure-white'}`}
                >
                    Upcoming
                </button>
                <button
                    onClick={() => setViewMode('full')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${viewMode === 'full' ? 'bg-primary-red text-pure-white shadow-sm' : 'text-highlight-silver hover:text-pure-white'}`}
                >
                    Full Season
                </button>
            </div>

            {viewMode === 'full' && events.length > 0 && (
                <div className="flex items-center gap-2.5 sm:gap-3 bg-carbon-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-pure-white/10 shadow-xl animate-fade-in origin-top flex-wrap justify-center">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10B981]"></div>
                        <span className="text-[9px] font-bold text-highlight-silver uppercase tracking-wider">Complete</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_5px_#EAB308]"></div>
                        <span className="text-[9px] font-bold text-highlight-silver uppercase tracking-wider">Sprint</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_5px_#A855F7]"></div>
                        <span className="text-[9px] font-bold text-highlight-silver uppercase tracking-wider">Next</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_5px_#EF4444]"></div>
                        <span className="text-[9px] font-bold text-highlight-silver uppercase tracking-wider">Cancelled</span>
                    </div>
                </div>
            )}
        </div>
    );
    
    const hubAction = (
        <button 
            onClick={() => setActivePage('league-hub')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">League Hub</span>
        </button>
    );


    if (!events || events.length === 0) {
        return (
            <div className="flex flex-col h-full w-full max-w-7xl mx-auto">
                <div className="flex-none">
                    <PageHeader title="SEASON CALENDAR" icon={CalendarIcon} leftAction={hubAction} />
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                    <CalendarIcon className="w-24 h-24 text-accent-gray opacity-20 mb-6" />
                    <h2 className="text-3xl font-black text-pure-white italic uppercase mb-3">No Races Found</h2>
                    <p className="text-highlight-silver max-w-md mb-8">The season schedule has not been synchronized.</p>
                    <button onClick={handleRetry} disabled={isRefreshing} className="bg-primary-red hover:bg-red-600 text-pure-white font-bold py-3 px-10 rounded-lg">
                        {isRefreshing ? 'Syncing...' : 'Sync Calendar'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col md:h-full md:overflow-hidden w-full max-w-7xl mx-auto">
                <div className="flex-none">
                    <PageHeader 
                        title="SEASON CALENDAR" 
                        icon={CalendarIcon} 
                        subtitle="All times displayed in EST"
                        rightAction={RightAction}
                        leftAction={hubAction}
                    />
                </div>

                {viewMode === 'upcoming' && (
                    <div className="md:flex-1 md:min-h-0 flex flex-col md:overflow-hidden">
                        <div 
                            className="md:overflow-y-auto custom-scrollbar md:flex-1 md:min-h-0 px-4 md:px-4 pb-24 md:pb-8 pt-2"
                            style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}
                        >
                            {nextRace ? (
                                <div className="mb-6 animate-fade-in flex-none">
                                    <NextRaceHero event={nextRace} schedule={schedules[nextRace.id]} isCancelled={cancelledEventIds.has(nextRace.id)} />
                                </div>
                            ) : (
                                <div className="bg-carbon-fiber rounded-2xl p-8 border border-pure-white/5 text-center mb-6 opacity-60">
                                    <p className="text-highlight-silver italic">The 2026 Season has concluded.</p>
                                </div>
                            )}

                            {upcomingRaces.length > 0 && (
                                <div className="animate-fade-in-up">
                                    <h3 className="text-lg font-bold text-highlight-silver mb-3 uppercase tracking-wider">Next 5 Rounds</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                        {upcomingRaces.map(event => {
                                            const isCancelled = cancelledEventIds.has(event.id);
                                            const isCompletedResult = !!raceResults?.[event.id]?.grandPrixFinish?.[0];
                                            const qualiTime = event.hasSprint ? (schedules[event.id]?.sprintQualifying || schedules[event.id]?.qualifying) : schedules[event.id]?.qualifying;
                                            const lockTimeIso = qualiTime || event.lockAtUtc;
                                            const lockDate = parseLeagueDate(lockTimeIso);
                                            const isPastPicksDue = lockDate ? new Date() >= lockDate : false;
                                            const isCompleted = !isCancelled && (isCompletedResult || isPastPicksDue);

                                            return (
                                                <div key={event.id}>
                                                    <CompactEventCard 
                                                        event={event} 
                                                        schedule={schedules[event.id]} 
                                                        isNext={nextRace?.id === event.id} 
                                                        isCancelled={isCancelled}
                                                        isCompleted={isCompleted}
                                                        onClick={() => setSelectedEvent(event)}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {viewMode === 'full' && (
                    <div 
                        className="md:flex-1 md:overflow-y-auto custom-scrollbar animate-fade-in px-4 md:px-4 pb-24 md:pb-8 pt-2"
                        style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {events.map(event => {
                                const isCancelled = cancelledEventIds.has(event.id);
                                const isCompletedResult = !!raceResults?.[event.id]?.grandPrixFinish?.[0];
                                const qualiTime = event.hasSprint ? (schedules[event.id]?.sprintQualifying || schedules[event.id]?.qualifying) : schedules[event.id]?.qualifying;
                                const lockTimeIso = qualiTime || event.lockAtUtc;
                                const lockDate = parseLeagueDate(lockTimeIso);
                                const isPastPicksDue = lockDate ? new Date() >= lockDate : false;
                                const isCompleted = !isCancelled && (isCompletedResult || isPastPicksDue);

                                return (
                                    <EventGridCard 
                                        key={event.id} 
                                        event={event} 
                                        schedule={schedules[event.id]} 
                                        isNext={nextRace?.id === event.id} 
                                        onClick={() => setSelectedEvent(event)}
                                        isCompleted={isCompleted}
                                        isCancelled={isCancelled}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {selectedEvent && (() => {
                const isSelectedCancelled = cancelledEventIds.has(selectedEvent.id);
                const isSelectedNext = nextRace?.id === selectedEvent.id;
                const isSelectedCompletedResult = !!raceResults?.[selectedEvent.id]?.grandPrixFinish?.[0];
                const qualiTime = selectedEvent.hasSprint ? (schedules[selectedEvent.id]?.sprintQualifying || schedules[selectedEvent.id]?.qualifying) : schedules[selectedEvent.id]?.qualifying;
                const lockTimeIso = qualiTime || selectedEvent.lockAtUtc;
                const lockDate = parseLeagueDate(lockTimeIso);
                const isSelectedPastPicksDue = lockDate ? new Date() >= lockDate : false;
                const isSelectedCompleted = !isSelectedCancelled && (isSelectedCompletedResult || isSelectedPastPicksDue);

                return (
                    <EventDetailsModal 
                        event={selectedEvent} 
                        schedule={schedules[selectedEvent.id]} 
                        onClose={() => setSelectedEvent(null)} 
                        isCancelled={isSelectedCancelled}
                        isCompleted={isSelectedCompleted}
                        isNext={isSelectedNext}
                    />
                );
            })()}
        </>
    );
};

const NextRaceHero: React.FC<{ event: Event; schedule?: EventSchedule; isCancelled?: boolean }> = ({ event, schedule, isCancelled }) => {
    const raceRaw = schedule?.race || event.lockAtUtc;
    return (
        <div className={`relative overflow-hidden rounded-2xl bg-carbon-fiber border ${isCancelled ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.2)] opacity-80' : 'border-purple-500/60 shadow-[0_0_25px_rgba(168,85,247,0.25)]'} shadow-2xl transition-all`}>
            {isCancelled && (
                <div className="absolute top-4 right-4 bg-red-600 text-pure-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider z-20 shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                    Cancelled
                </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-purple-900/10 to-transparent pointer-events-none"></div>
            <div className="relative z-10 p-5 md:p-8 flex flex-col md:flex-row gap-6 md:gap-8">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <span className="bg-carbon-black/60 border border-pure-white/10 text-highlight-silver text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            Round {event.round}
                        </span>
                        <div className="inline-flex items-center gap-1.5 bg-purple-500/20 border border-purple-500/60 text-purple-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-[0_0_12px_rgba(168,85,247,0.3)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                            <span>Next Grand Prix</span>
                        </div>
                        {event.hasSprint && (
                            <div className="inline-flex items-center gap-1 bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                                <SprintIcon className="w-3.5 h-3.5 text-yellow-500" />
                                <span>Sprint Weekend</span>
                            </div>
                        )}
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-pure-white mb-2 leading-none">{event.name}</h2>
                    <div className="flex flex-col gap-1 mb-6">
                        <div className="flex items-center gap-2 text-lg md:text-xl text-highlight-silver">
                            <span className="font-bold text-pure-white">{event.country}</span>
                            <span className="text-highlight-silver/80">, {event.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-highlight-silver/70 mt-1">
                            <CircuitRoute eventId={event.id} className="w-5 h-5 text-highlight-silver" />
                            {event.circuit}
                        </div>
                    </div>
                    <div className="bg-carbon-black/60 p-4 rounded-xl border border-purple-500/30 inline-block shadow-lg">
                        <p className="text-xs text-purple-400 font-black uppercase tracking-widest mb-1">Lights Out</p>
                        <p className="text-2xl md:text-3xl font-bold text-pure-white">
                            {formatSessionDate(raceRaw)} <span className="text-purple-400 mx-1.5">•</span> {formatSessionTime(raceRaw)}
                        </p>
                    </div>
                </div>
                <div className="flex-1 bg-pure-white/5 backdrop-blur-sm rounded-xl p-5 border border-pure-white/10">
                    <h3 className="text-xs md:text-sm font-bold text-pure-white uppercase tracking-wider mb-4 border-b border-pure-white/10 pb-2 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-purple-400" />
                        Session Timetable
                    </h3>
                    <div className="space-y-3">
                        {!event.hasSprint ? (
                            <>
                                <SessionRow label="Practice 1" time={schedule?.fp1} />
                                <SessionRow label="Practice 2" time={schedule?.fp2} />
                                <SessionRow label="Practice 3" time={schedule?.fp3} />
                                <SessionRow label="Qualifying" time={schedule?.qualifying} highlight />
                            </>
                        ) : (
                            <>
                                <SessionRow label="Practice 1" time={schedule?.fp1} />
                                <SessionRow label="Sprint Quali" time={schedule?.sprintQualifying} />
                                <SessionRow label="Sprint" time={schedule?.sprint} highlight accentColor="#EAB308" />
                                <SessionRow label="Qualifying" time={schedule?.qualifying} highlight />
                            </>
                        )}
                        <SessionRow label="Grand Prix" time={raceRaw} isRace accentColor="#A855F7" />
                    </div>
                </div>
            </div>
        </div>
    );
};

const EventDetailsModal: React.FC<{ 
    event: Event; 
    schedule?: EventSchedule; 
    onClose: () => void; 
    isCancelled?: boolean;
    isCompleted?: boolean;
    isNext?: boolean;
}> = ({ event, schedule, onClose, isCancelled, isCompleted, isNext }) => {
    const raceRaw = schedule?.race || event.lockAtUtc;

    const accentColor = isCancelled 
        ? '#EF4444' 
        : isCompleted 
            ? '#10B981' 
            : isNext 
                ? '#A855F7' 
                : (event.hasSprint ? '#EAB308' : '#C0C0C0');

    const borderStyle = isCancelled
        ? 'border-red-500/60 shadow-[0_0_30px_rgba(239,68,68,0.25)]'
        : isCompleted
            ? 'border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.2)]'
            : isNext
                ? 'border-purple-500/60 shadow-[0_0_30px_rgba(168,85,247,0.25)]'
                : event.hasSprint
                    ? 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)]'
                    : 'border-pure-white/15 shadow-2xl';

    const gradientClass = isCancelled
        ? 'from-red-600/20'
        : isCompleted
            ? 'from-emerald-600/20'
            : isNext
                ? 'from-purple-600/20'
                : event.hasSprint
                    ? 'from-yellow-600/15'
                    : 'from-pure-white/10';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div 
                className={`w-full max-w-4xl relative overflow-hidden rounded-2xl bg-carbon-fiber border ${borderStyle} animate-scale-in flex flex-col max-h-[85vh] ${isCancelled ? 'opacity-90' : ''}`} 
                onClick={e => e.stopPropagation()}
            >
                <div className="overflow-y-auto custom-scrollbar relative w-full h-full">
                    <button onClick={onClose} className="absolute top-3 right-3 z-30 bg-carbon-black/80 hover:bg-carbon-black text-pure-white rounded-full p-2 border border-pure-white/20 shadow-lg transition-transform hover:scale-110">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradientClass} via-transparent to-transparent pointer-events-none h-48`}></div>
                    
                    <div className="relative z-10 p-5 md:p-10 flex flex-col md:flex-row gap-6 md:gap-12">
                        <div className="flex-1 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                <span className="text-[10px] md:text-xs font-bold text-highlight-silver bg-carbon-black/60 border border-pure-white/10 px-3 py-1 rounded-full uppercase tracking-wider">
                                    Round {event.round}
                                </span>

                                {event.hasSprint && (
                                    <div className="px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 text-[10px] md:text-xs font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_8px_rgba(234,179,8,0.2)]">
                                        <SprintIcon className="w-3.5 h-3.5 text-yellow-500" />
                                        <span>SPRINT WEEKEND</span>
                                    </div>
                                )}

                                {isCancelled ? (
                                    <div className="px-3 py-1 rounded-full bg-red-600/20 border border-red-500/60 text-red-400 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                        <span>CANCELLED</span>
                                    </div>
                                ) : isCompleted ? (
                                    <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                                        <CheckeredFlagIcon className="w-3.5 h-3.5 text-emerald-400" />
                                        <span>EVENT COMPLETE</span>
                                    </div>
                                ) : isNext ? (
                                    <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/60 text-purple-300 text-[10px] md:text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(168,85,247,0.3)]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                                        <span>NEXT RACE</span>
                                    </div>
                                ) : null}
                            </div>
                            
                            <h2 className="text-3xl md:text-5xl font-black text-pure-white mb-2 leading-none tracking-tight">{event.name}</h2>
                            
                            <div className="flex flex-col gap-1 mb-6">
                                <p className="text-lg md:text-xl text-highlight-silver"><span className="font-bold text-pure-white">{event.country}</span>, {event.location}</p>
                                <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-highlight-silver/70 mt-1">
                                    <CircuitRoute eventId={event.id} className="w-5 h-5 text-highlight-silver" />
                                    {event.circuit}
                                </div>
                            </div>
                            
                            <div className="bg-carbon-black/60 p-4 md:p-5 rounded-xl border shadow-lg" style={{ borderColor: `${accentColor}40` }}>
                                <p className="text-[10px] md:text-xs uppercase tracking-widest font-black mb-2" style={{ color: accentColor }}>
                                    Grand Prix Start
                                </p>
                                <div className="flex flex-wrap items-baseline gap-x-3 md:gap-x-4">
                                    <span className="text-xl md:text-3xl font-bold text-pure-white">{formatSessionDate(raceRaw)}</span>
                                    <span className="text-xl md:text-3xl font-black text-pure-white tracking-tight">{formatSessionTime(raceRaw)}</span>
                                </div>
                                <p className="text-highlight-silver/40 mt-2 text-[9px] md:text-[10px] uppercase font-bold tracking-widest">Eastern Standard Time</p>
                            </div>
                        </div>
                        
                        <div className="flex-1 bg-pure-white/5 backdrop-blur-sm rounded-xl p-5 md:p-6 border border-pure-white/10">
                            <h3 className="text-xs md:text-sm font-bold text-pure-white uppercase tracking-wider mb-4 border-b border-pure-white/10 pb-3 flex items-center gap-2">
                                <CalendarIcon className="w-4 h-4 text-highlight-silver" /> Session Timetable
                            </h3>
                            <div className="space-y-3">
                                {!event.hasSprint ? (
                                    <>
                                        <SessionRow label="Practice 1" time={schedule?.fp1} />
                                        <SessionRow label="Practice 2" time={schedule?.fp2} />
                                        <SessionRow label="Practice 3" time={schedule?.fp3} />
                                        <SessionRow label="Qualifying" time={schedule?.qualifying} highlight />
                                    </>
                                ) : (
                                    <>
                                        <SessionRow label="Practice 1" time={schedule?.fp1} />
                                        <SessionRow label="Sprint Quali" time={schedule?.sprintQualifying} />
                                        <SessionRow label="Sprint" time={schedule?.sprint} highlight accentColor="#EAB308" />
                                        <SessionRow label="Qualifying" time={schedule?.qualifying} highlight />
                                    </>
                                )}
                                <SessionRow label="Grand Prix" time={raceRaw} isRace accentColor={accentColor} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SessionRow: React.FC<{ 
    label: string; 
    time?: string; 
    highlight?: boolean; 
    isRace?: boolean;
    accentColor?: string;
}> = ({ label, time, highlight, isRace, accentColor }) => {
    const activeColor = accentColor || '#DA291C';

    if (!time) return (
        <div className={`flex justify-between items-center ${isRace ? 'pt-3 mt-3 border-t border-pure-white/10' : ''}`}>
            <span className={`text-sm ${isRace ? 'font-bold uppercase' : 'text-highlight-silver opacity-50'}`} style={isRace ? { color: activeColor } : undefined}>{label}</span>
            <span className="text-xs font-bold text-highlight-silver opacity-30">TBA</span>
        </div>
    );

    return (
        <div className={`flex justify-between items-center ${isRace ? 'pt-3 mt-3 border-t border-pure-white/10' : ''}`}>
            <span className={`text-sm ${isRace ? 'font-bold uppercase' : (highlight ? 'font-bold' : 'font-medium text-highlight-silver')}`} style={(isRace || highlight) && accentColor ? { color: activeColor } : (highlight && !accentColor ? { color: '#FFFFFF' } : (isRace ? { color: activeColor } : undefined))}>
                {label}
            </span>
            <div className="text-right">
                <span className="block text-base font-bold text-pure-white">{formatSessionDate(time)}</span>
                <span className={`block text-sm font-mono ${isRace ? 'font-bold' : 'text-highlight-silver'}`} style={isRace ? { color: activeColor } : undefined}>{formatSessionTime(time)}</span>
            </div>
        </div>
    );
};

const CompactEventCard: React.FC<{ 
    event: Event; 
    schedule?: EventSchedule; 
    isNext?: boolean; 
    isCancelled?: boolean; 
    isCompleted?: boolean;
    onClick: () => void 
}> = ({ event, schedule, isNext, isCancelled, isCompleted, onClick }) => {
    const raceRaw = schedule?.race || event.lockAtUtc;
    return (
        <button 
            onClick={onClick} 
            className={`w-full text-left flex flex-col p-4 rounded-xl border transition-all h-full justify-between group hover:scale-[1.02] ${
                isCancelled 
                    ? 'border-red-500/40 bg-carbon-black/80 opacity-75' 
                    : isCompleted
                        ? 'border-emerald-500/30 bg-carbon-black'
                        : isNext 
                            ? 'bg-carbon-black border-purple-500 shadow-lg shadow-purple-500/20' 
                            : 'bg-carbon-fiber border-pure-white/10 shadow-lg'
            }`}
        >
            <div className="w-full">
                <div className="flex justify-between items-start mb-2 gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-highlight-silver uppercase">R{event.round}</span>
                        {isCancelled ? (
                            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Cancelled</span>
                        ) : isCompleted ? (
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Complete</span>
                        ) : isNext ? (
                            <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">Next</span>
                        ) : null}
                    </div>
                    {event.hasSprint && (
                        <div className="px-1.5 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 text-[8px] font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0" title="Sprint">
                            <SprintIcon className="w-2.5 h-2.5 text-yellow-500" />
                            <span>SPRINT</span>
                        </div>
                    )}
                </div>
                <h4 className="font-bold text-pure-white text-lg leading-tight mb-1 truncate">{event.country}</h4>
                <p className="text-xs text-highlight-silver truncate">{event.location}</p>
            </div>
            <div className="mt-auto pt-3 border-t border-pure-white/10 w-full">
                <p className="text-[10px] text-highlight-silver uppercase mb-0.5">Race</p>
                <p className="font-bold text-base text-pure-white">{formatSessionDate(raceRaw)}</p>
                <p className={`text-sm font-mono ${isNext ? 'text-purple-400 font-bold' : (isCompleted ? 'text-emerald-400 font-bold' : 'text-highlight-silver')}`}>{formatSessionTime(raceRaw)}</p>
            </div>
        </button>
    );
};

const EventGridCard: React.FC<{ 
    event: Event; 
    schedule?: EventSchedule; 
    isNext?: boolean; 
    onClick: () => void; 
    isCompleted?: boolean;
    isCancelled?: boolean;
}> = ({ event, schedule, isNext, onClick, isCompleted, isCancelled }) => {
    const accentColor = isCancelled 
        ? '#EF4444' 
        : isCompleted 
            ? '#10B981' 
            : isNext 
                ? '#A855F7' 
                : (event.hasSprint ? '#EAB308' : '#C0C0C0');

    const qualiTime = event.hasSprint ? (schedule?.sprintQualifying || schedule?.qualifying) : schedule?.qualifying;
    const qualiLabel = event.hasSprint ? "Sprint Quali" : "Qualifying";

    return (
        <button 
            onClick={onClick}
            className={`w-full text-left relative overflow-hidden rounded-xl border transition-all hover:scale-[1.02] flex flex-col h-full min-h-[180px] ${
                isCancelled 
                    ? 'bg-carbon-black/90 border-red-500/40 opacity-85' 
                    : isCompleted 
                        ? 'bg-carbon-black border-emerald-500/30' 
                        : isNext
                            ? 'bg-carbon-black border-purple-500/60 shadow-[0_0_20px_rgba(168,85,247,0.2)]'
                            : 'bg-carbon-black'
            }`}
            style={{ 
                borderColor: !isCancelled && !isCompleted && !isNext ? `${accentColor}60` : undefined, 
                boxShadow: isNext && !isCancelled && !isCompleted ? `0 0 20px ${hexToRgba(accentColor, 0.25)}` : undefined
            }} 
        >
            <div className="absolute inset-0 z-0 opacity-10" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, transparent 75%)` }} />
            
            <div className="relative z-10 p-4 sm:p-5 flex flex-col h-full w-full">
                {/* Top metadata & status bar */}
                <div className="flex items-center justify-between gap-2 mb-2.5 w-full">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] sm:text-xs font-bold text-highlight-silver uppercase tracking-wider">Round</span>
                        <span className="text-xl sm:text-2xl font-black text-pure-white leading-none">{event.round}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {event.hasSprint && (
                            <div className="px-2 py-0.5 rounded bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-[0_0_8px_rgba(234,179,8,0.15)]" title="Sprint Weekend">
                                <SprintIcon className="w-3 h-3 text-yellow-500" />
                                <span>SPRINT</span>
                            </div>
                        )}

                        {isCancelled ? (
                            <div className="px-2 py-0.5 rounded bg-red-600/20 border border-red-500/60 text-red-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                <span>CANCELLED</span>
                            </div>
                        ) : isCompleted ? (
                            <div className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/60 text-emerald-400 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                                <CheckeredFlagIcon className="w-3 h-3 text-emerald-400" />
                                <span>EVENT COMPLETE</span>
                            </div>
                        ) : isNext ? (
                            <div className="px-2 py-0.5 rounded bg-purple-500/20 border border-purple-500/60 text-purple-300 text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-[0_0_8px_rgba(168,85,247,0.2)]">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
                                <span>NEXT RACE</span>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Grand Prix name & location given full width */}
                <div className="mb-4 w-full">
                    <h3 className="text-lg sm:text-xl font-bold text-pure-white truncate leading-snug">{event.name}</h3>
                    <p className="text-xs sm:text-sm text-highlight-silver truncate mt-0.5">{event.location}, {event.country}</p>
                </div>

                {/* Bottom session times */}
                <div className="mt-auto w-full pt-3 border-t border-pure-white/10">
                    <div className="flex items-end justify-between w-full gap-2">
                        <div className="min-w-0">
                            <p className="text-[10px] text-highlight-silver uppercase font-bold tracking-wider mb-0.5 truncate">{qualiLabel}</p>
                            <p className="font-semibold text-xs sm:text-base text-ghost-white truncate">{formatSessionDate(qualiTime)}</p>
                        </div>
                        <div className="text-right flex flex-col items-end shrink-0">
                            {isCancelled ? (
                                <span className="bg-red-500/20 border border-red-500/40 text-red-400 text-[8px] font-black px-1.5 py-0.5 rounded mb-1 uppercase tracking-wider">CANCELLED</span>
                            ) : isCompleted ? (
                                <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded mb-1 uppercase tracking-wider">PICKS CLOSED</span>
                            ) : (
                                <span className="bg-primary-red text-pure-white text-[8px] font-black px-1.5 py-0.5 rounded mb-1 uppercase tracking-wider">PICKS DUE</span>
                            )}
                            <p className="font-mono text-xs sm:text-base font-bold text-pure-white">{formatSessionTime(qualiTime)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </button>
    );
};

export default SchedulePage;