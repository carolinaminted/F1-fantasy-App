import React, { useState, useMemo } from 'react';
import { Event, EventSchedule, RaceResults } from '../types.ts';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { CircuitRoute } from './icons/CircuitRoutes.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { Page } from '../App.tsx';
import { BackIcon } from './icons/BackIcon.tsx';

interface SchedulePageProps {
    schedules: { [eventId: string]: EventSchedule };
    events: Event[];
    onRefresh?: () => Promise<void>;
    raceResults?: RaceResults;
    setActivePage: (page: Page) => void;
}

/**
 * LEAGUE TIMEZONE CONFIGURATION
 * All session dates and times are interpreted and displayed in America/New_York.
 */
const LEAGUE_TIMEZONE = 'America/New_York';

/**
 * Robust parsing helper.
 * If the string lacks a timezone suffix (typical for datetime-local strings from Admin),
 * we parse it while forcing it into the League's context (America/New_York).
 */
const parseToDate = (isoString?: string) => {
    if (!isoString) return null;
    
    // 1. If it's already an absolute ISO string from constants (ends with Z)
    if (isoString.endsWith('Z')) return new Date(isoString);

    // 2. If it's a local string from Admin (e.g. 2026-03-29T14:00)
    // We must parse this as being in the context of the LEAGUE_TIMEZONE (EST/EDT)
    try {
        const normalized = isoString.replace(' ', 'T');
        // Simple but effective: treat the string as browser local, then adjust for the TZ difference
        const tempDate = new Date(normalized);
        const leagueString = tempDate.toLocaleString('en-US', { timeZone: LEAGUE_TIMEZONE });
        const leagueDate = new Date(leagueString);
        const diff = tempDate.getTime() - leagueDate.getTime();
        const finalDate = new Date(tempDate.getTime() + diff);
        
        return isNaN(finalDate.getTime()) ? null : finalDate;
    } catch (e) {
        const fallback = new Date(isoString);
        return isNaN(fallback.getTime()) ? null : fallback;
    }
};

/**
 * Robust formatting helpers to ensure the day and time are calculated 
 * strictly in the league timezone (EST/EDT).
 */
const formatSessionDate = (isoString?: string) => {
    const date = parseToDate(isoString);
    if (!date) return 'TBA';
    
    return new Intl.DateTimeFormat('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        timeZone: LEAGUE_TIMEZONE
    }).format(date);
};

const formatSessionTime = (isoString?: string) => {
    const date = parseToDate(isoString);
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

const SchedulePage: React.FC<SchedulePageProps> = ({ schedules, events, onRefresh, raceResults, setActivePage }) => {
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
            const raceTime = parseToDate(raceRaw);
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
                <div className="flex items-center gap-3 bg-carbon-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-pure-white/10 shadow-xl animate-fade-in origin-top">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-highlight-silver shadow-[0_0_5px_#C0C0C0]"></div>
                        <span className="text-[9px] font-bold text-highlight-silver uppercase tracking-wider">Race</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 shadow-[0_0_5px_#EAB308]"></div>
                        <span className="text-[9px] font-bold text-highlight-silver uppercase tracking-wider">Sprint</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-red shadow-[0_0_5px_#DA291C]"></div>
                        <span className="text-[9px] font-bold text-highlight-silver uppercase tracking-wider">Next</span>
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
                                    <NextRaceHero event={nextRace} schedule={schedules[nextRace.id]} />
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
                                        {upcomingRaces.map(event => (
                                            <div key={event.id}>
                                                <CompactEventCard 
                                                    event={event} 
                                                    schedule={schedules[event.id]} 
                                                    isNext={nextRace?.id === event.id} 
                                                    onClick={() => setSelectedEvent(event)}
                                                />
                                            </div>
                                        ))}
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
                                const isCompleted = !!raceResults?.[event.id]?.grandPrixFinish?.[0];
                                return (
                                    <EventGridCard 
                                        key={event.id} 
                                        event={event} 
                                        schedule={schedules[event.id]} 
                                        isNext={nextRace?.id === event.id} 
                                        onClick={() => setSelectedEvent(event)}
                                        isCompleted={isCompleted}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {selectedEvent && (
                <EventDetailsModal 
                    event={selectedEvent} 
                    schedule={schedules[selectedEvent.id]} 
                    onClose={() => setSelectedEvent(null)} 
                />
            )}
        </>
    );
};

const NextRaceHero: React.FC<{ event: Event; schedule?: EventSchedule }> = ({ event, schedule }) => {
    const raceRaw = schedule?.race || event.lockAtUtc;
    return (
        <div className="relative overflow-hidden rounded-2xl bg-carbon-fiber border border-pure-white/10 shadow-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-red/20 to-transparent pointer-events-none"></div>
            <div className="relative z-10 p-6 flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                    <div className="inline-block bg-primary-red text-pure-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4">Next Grand Prix</div>
                    <h2 className="text-4xl md:text-5xl font-black text-pure-white mb-2 leading-none">{event.name}</h2>
                    <div className="flex flex-col gap-1 mb-6">
                        <div className="flex items-center gap-2 text-xl text-highlight-silver">
                            <span className="font-bold">{event.country}</span>
                            <span className="text-highlight-silver/70">, {event.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm font-bold text-highlight-silver/70 mt-1">
                            <CircuitRoute eventId={event.id} className="w-5 h-5 text-highlight-silver" />
                            {event.circuit}
                        </div>
                    </div>
                    <div className="bg-carbon-black/50 p-4 rounded-xl border border-pure-white/10 inline-block">
                        <p className="text-xs text-highlight-silver uppercase tracking-widest mb-1">Lights Out</p>
                        <p className="text-2xl md:text-3xl font-bold text-pure-white">
                            {formatSessionDate(raceRaw)} <span className="text-primary-red mx-1">•</span> {formatSessionTime(raceRaw)}
                        </p>
                    </div>
                </div>
                <div className="flex-1 bg-pure-white/5 backdrop-blur-sm rounded-xl p-5 border border-pure-white/5">
                    <h3 className="text-sm font-bold text-pure-white uppercase tracking-wider mb-4 border-b border-pure-white/10 pb-2">Session Timetable</h3>
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
                                <SessionRow label="Sprint" time={schedule?.sprint} highlight />
                                <SessionRow label="Qualifying" time={schedule?.qualifying} highlight />
                            </>
                        )}
                        <SessionRow label="Grand Prix" time={raceRaw} isRace />
                    </div>
                </div>
            </div>
        </div>
    );
};

const EventDetailsModal: React.FC<{ event: Event; schedule?: EventSchedule; onClose: () => void }> = ({ event, schedule, onClose }) => {
    const raceRaw = schedule?.race || event.lockAtUtc;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            {/* Added max-h-[85vh] and overflow-y-auto to handle small screens better */}
            <div className="w-full max-w-4xl relative overflow-hidden rounded-2xl bg-carbon-fiber border border-pure-white/10 shadow-2xl animate-scale-in flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                
                {/* Scrollable Container */}
                <div className="overflow-y-auto custom-scrollbar relative w-full h-full">
                    {/* Close Button - Sticky or Fixed */}
                    <button onClick={onClose} className="absolute top-3 right-3 z-30 bg-carbon-black/80 hover:bg-carbon-black text-pure-white rounded-full p-2 border border-pure-white/20 shadow-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-red/10 via-transparent to-transparent pointer-events-none h-48"></div>
                    
                    {/* Content - Reduced padding on mobile (p-5 instead of p-6) */}
                    <div className="relative z-10 p-5 md:p-10 flex flex-col md:flex-row gap-6 md:gap-12">
                        <div className="flex-1 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] md:text-xs font-bold text-highlight-silver bg-carbon-black/50 border border-pure-white/10 px-3 py-1 rounded-full uppercase tracking-wider">Round {event.round}</span>
                            </div>
                            
                            {/* Smaller Title on Mobile */}
                            <h2 className="text-3xl md:text-5xl font-black text-pure-white mb-2 leading-none tracking-tight">{event.name}</h2>
                            
                            <div className="flex flex-col gap-1 mb-6">
                                <p className="text-lg md:text-xl text-highlight-silver"><span className="font-bold text-pure-white">{event.country}</span>, {event.location}</p>
                                <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-highlight-silver/70 mt-1">
                                    <CircuitRoute eventId={event.id} className="w-5 h-5 text-highlight-silver" />
                                    {event.circuit}
                                </div>
                            </div>
                            
                            <div className="bg-carbon-black/60 p-4 md:p-5 rounded-xl border border-pure-white/10 shadow-lg">
                                <p className="text-[10px] md:text-xs text-primary-red uppercase tracking-widest font-black mb-2">Grand Prix Start</p>
                                <div className="flex flex-wrap items-baseline gap-x-3 md:gap-x-4">
                                    <span className="text-xl md:text-3xl font-bold text-pure-white">{formatSessionDate(raceRaw)}</span>
                                    <span className="text-xl md:text-3xl font-black text-pure-white tracking-tight">{formatSessionTime(raceRaw)}</span>
                                </div>
                                <p className="text-highlight-silver/40 mt-2 text-[9px] md:text-[10px] uppercase font-bold tracking-widest">Eastern Standard Time</p>
                            </div>
                        </div>
                        
                        <div className="flex-1 bg-pure-white/5 backdrop-blur-sm rounded-xl p-5 md:p-6 border border-pure-white/5">
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
                                        <SessionRow label="Sprint" time={schedule?.sprint} highlight />
                                        <SessionRow label="Qualifying" time={schedule?.qualifying} highlight />
                                    </>
                                )}
                                <SessionRow label="Grand Prix" time={raceRaw} isRace />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SessionRow: React.FC<{ label: string; time?: string; highlight?: boolean; isRace?: boolean }> = ({ label, time, highlight, isRace }) => {
    if (!time) return (
        <div className={`flex justify-between items-center ${isRace ? 'pt-3 mt-3 border-t border-pure-white/10' : ''}`}>
            <span className={`text-sm ${isRace ? 'font-bold text-primary-red' : 'text-highlight-silver opacity-50'}`}>{label}</span>
            <span className="text-xs font-bold text-highlight-silver opacity-30">TBA</span>
        </div>
    );

    return (
        <div className={`flex justify-between items-center ${isRace ? 'pt-3 mt-3 border-t border-pure-white/10' : ''}`}>
            <span className={`text-sm ${isRace ? 'font-bold text-primary-red uppercase' : (highlight ? 'font-bold text-pure-white' : 'font-medium text-highlight-silver')}`}>
                {label}
            </span>
            <div className="text-right">
                <span className="block text-base font-bold text-pure-white">{formatSessionDate(time)}</span>
                <span className={`block text-sm font-mono ${isRace ? 'text-primary-red font-bold' : 'text-highlight-silver'}`}>{formatSessionTime(time)}</span>
            </div>
        </div>
    );
};

const CompactEventCard: React.FC<{ event: Event; schedule?: EventSchedule; isNext?: boolean; onClick: () => void }> = ({ event, schedule, isNext, onClick }) => {
    const raceRaw = schedule?.race || event.lockAtUtc;
    return (
        <button onClick={onClick} className={`w-full text-left flex flex-col p-4 rounded-xl border transition-all h-full justify-between group hover:scale-[1.02] ${isNext ? 'bg-carbon-black border-primary-red shadow-lg' : 'bg-carbon-fiber border-pure-white/10 shadow-lg'}`}>
            <div className="w-full">
                <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-highlight-silver uppercase">R{event.round}</span>
                    {event.hasSprint && <SprintIcon className="w-4 h-4 text-yellow-500" />}
                </div>
                <h4 className="font-bold text-pure-white text-lg leading-tight mb-1 truncate">{event.country}</h4>
                <p className="text-xs text-highlight-silver truncate">{event.location}</p>
            </div>
            <div className="mt-auto pt-3 border-t border-pure-white/10 w-full">
                <p className="text-[10px] text-highlight-silver uppercase mb-0.5">Race</p>
                <p className="font-bold text-base text-pure-white">{formatSessionDate(raceRaw)}</p>
                <p className="text-sm text-primary-red font-mono">{formatSessionTime(raceRaw)}</p>
            </div>
        </button>
    );
};

const EventGridCard: React.FC<{ event: Event; schedule?: EventSchedule; isNext?: boolean; onClick: () => void; isCompleted?: boolean }> = ({ event, schedule, isNext, onClick, isCompleted }) => {
    const accentColor = event.hasSprint ? '#EAB308' : (isNext ? '#DA291C' : '#C0C0C0');
    const qualiTime = event.hasSprint ? (schedule?.sprintQualifying || schedule?.qualifying) : schedule?.qualifying;
    const qualiLabel = event.hasSprint ? "Sprint Quali" : "Qualifying";

    return (
        <button 
            onClick={onClick}
            className="w-full text-left relative overflow-hidden rounded-xl bg-carbon-black border transition-all hover:scale-[1.02] flex flex-col h-full min-h-[180px]"
            style={{ 
                borderColor: `${accentColor}60`, 
                boxShadow: isNext ? `0 0 20px ${hexToRgba(accentColor, 0.2)}` : `0 0 10px ${hexToRgba(accentColor, 0.05)}`
            }} 
        >
            <div className="absolute inset-0 z-0 opacity-10" style={{ background: `linear-gradient(135deg, ${accentColor} 0%, transparent 75%)` }} />
            <div className="relative z-10 p-5 flex flex-col h-full w-full">
                <div className="flex justify-between items-start mb-4 w-full">
                    <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-xs font-bold text-highlight-silver uppercase">Round</span>
                            <span className="text-2xl font-black text-pure-white leading-none">{event.round}</span>
                        </div>
                        <h3 className="text-xl font-bold text-pure-white truncate">{event.name}</h3>
                        <p className="text-sm text-highlight-silver truncate mt-0.5">{event.location}, {event.country}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-2">
                        {isCompleted && (
                            <div className="bg-green-500/20 p-1.5 rounded-lg border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.3)]">
                                <CheckeredFlagIcon className="w-4 h-4 text-green-500" />
                            </div>
                        )}
                        {event.hasSprint && <SprintIcon className="w-7 h-7 text-yellow-500" />}
                        <div className="w-2 h-10 rounded-full" style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }} />
                    </div>
                </div>
                <div className="mt-auto w-full pt-4 border-t border-pure-white/10">
                    <div className="flex items-end justify-between w-full">
                        <div>
                            <p className="text-[10px] text-highlight-silver uppercase font-bold tracking-wider mb-0.5">{qualiLabel}</p>
                            <p className="font-semibold text-base text-ghost-white">{formatSessionDate(qualiTime)}</p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                             <span className="bg-primary-red text-pure-white text-[8px] font-black px-1.5 py-0.5 rounded mb-1 uppercase tracking-wider">Picks Due</span>
                             <p className="font-mono text-base font-bold text-pure-white">{formatSessionTime(qualiTime)}</p>
                        </div>
                    </div>
                </div>
            </div>
        </button>
    );
};

export default SchedulePage;