
import React, { useState, useMemo } from 'react';
import { Event, EventSchedule } from '../types.ts';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { CircuitRoute } from './icons/CircuitRoutes.tsx';

interface SchedulePageProps {
    schedules: { [eventId: string]: EventSchedule };
    events: Event[];
}

const SchedulePage: React.FC<SchedulePageProps> = ({ schedules, events }) => {
    const [viewMode, setViewMode] = useState<'upcoming' | 'full'>('upcoming');

    const nextRace = useMemo(() => {
        const now = new Date();
        return events.find(e => {
            const sched = schedules[e.id];
            const raceTime = sched?.race ? new Date(sched.race) : new Date(e.lockAtUtc);
            const raceEndTime = new Date(raceTime.getTime() + 2 * 60 * 60 * 1000); 
            return raceEndTime > now;
        });
    }, [schedules, events]);

    const upcomingRaces = useMemo(() => {
        if (!nextRace) return [];
        const idx = events.findIndex(e => e.id === nextRace.id);
        return events.slice(idx, idx + 5);
    }, [nextRace, events]);

    return (
        <div className="max-w-7xl mx-auto w-full pb-20 md:pb-0 md:h-[calc(100vh-6rem)] md:overflow-hidden md:flex md:flex-col">
            <div className="flex-none flex items-center justify-between mb-4 md:mb-6 px-4 md:px-0 pt-4 md:pt-0">
                <div className="flex flex-col">
                    <h1 className="text-3xl font-bold text-pure-white flex items-center gap-3">
                        <CalendarIcon className="w-8 h-8 text-primary-red" />
                        Race Calendar
                    </h1>
                    <p className="text-xs text-highlight-silver mt-1 ml-11">All times displayed in EST</p>
                </div>
                <div className="flex bg-accent-gray rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('upcoming')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${viewMode === 'upcoming' ? 'bg-primary-red text-pure-white' : 'text-highlight-silver hover:text-pure-white'}`}
                    >
                        Upcoming
                    </button>
                    <button
                        onClick={() => setViewMode('full')}
                        className={`px-4 py-1.5 rounded-md text-xs font-bold transition-colors ${viewMode === 'full' ? 'bg-primary-red text-pure-white' : 'text-highlight-silver hover:text-pure-white'}`}
                    >
                        Full Season
                    </button>
                </div>
            </div>

            {/* Upcoming View - Flex Container for Desktop */}
            {viewMode === 'upcoming' && (
                <div className="flex-1 min-h-0 flex flex-col md:overflow-hidden">
                    {/* Hero: Next Race */}
                    {nextRace && (
                        <div className="px-4 md:px-0 mb-6 animate-fade-in flex-none">
                            <NextRaceHero event={nextRace} schedule={schedules[nextRace.id]} />
                        </div>
                    )}

                    {/* Next 5 List */}
                    <div className="px-4 md:px-0 animate-fade-in-up flex-1 min-h-0 flex flex-col">
                        <h3 className="text-lg font-bold text-highlight-silver mb-3 uppercase tracking-wider flex-none">Next 5 Rounds</h3>
                        {/* 
                            Updated Grid Container: 
                            - Removed overflow-y-auto (no scroll)
                            - Removed custom-scrollbar
                            - Reduced bottom padding to pb-2 just for border clearance
                            - Kept h-full to fill available flex space
                        */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:h-full pb-2">
                            {upcomingRaces.map(event => (
                                <div key={event.id} className="md:h-full">
                                    <CompactEventCard event={event} schedule={schedules[event.id]} isNext={nextRace?.id === event.id} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Full Schedule List - Scrollable on Desktop */}
            {viewMode === 'full' && (
                <div className="px-4 md:px-0 space-y-3 animate-fade-in md:flex-1 md:overflow-y-auto custom-scrollbar md:pr-2 pb-6">
                    {events.map(event => (
                        <FullEventRow key={event.id} event={event} schedule={schedules[event.id]} isNext={nextRace?.id === event.id} />
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Sub-components ---

const formatDate = (isoString?: string) => {
    if (!isoString) return 'TBA';
    const date = new Date(isoString);
    // Explicitly use America/New_York timezone
    return date.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        timeZone: 'America/New_York'
    });
};

const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    // Explicitly use America/New_York timezone
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/New_York'
    });
};

const NextRaceHero: React.FC<{ event: Event; schedule?: EventSchedule }> = ({ event, schedule }) => {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-carbon-fiber border border-pure-white/10 shadow-2xl">
            {/* Background Texture */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary-red/20 to-transparent pointer-events-none"></div>
            
            <div className="relative z-10 p-6 flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                    <div className="inline-block bg-primary-red text-pure-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4">
                        Next Grand Prix
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-pure-white mb-2 leading-none">{event.name}</h2>
                    <div className="flex flex-col gap-1 mb-6">
                        <div className="flex items-center gap-2 text-xl text-highlight-silver">
                            <span className="font-bold">{event.country}</span>
                            <span className="text-highlight-silver/70">, {event.location}</span>
                            {event.hasSprint && (
                                <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 text-xs px-2 py-0.5 rounded border border-yellow-500/30 ml-2 font-bold uppercase">
                                    <SprintIcon className="w-3 h-3 text-yellow-500" />
                                    Sprint
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm font-bold text-highlight-silver/70">
                            <CircuitRoute eventId={event.id} className="w-5 h-5 text-highlight-silver" />
                            {event.circuit}
                        </div>
                    </div>
                    
                    {/* Main Countdown or Date */}
                    <div className="bg-carbon-black/50 p-4 rounded-xl border border-pure-white/10 inline-block backdrop-blur-sm">
                        <p className="text-xs text-highlight-silver uppercase tracking-widest mb-1">Lights Out</p>
                        <p className="text-2xl md:text-3xl font-bold text-pure-white">
                            {schedule?.race ? (
                                <>
                                    {formatDate(schedule.race)} <span className="text-primary-red mx-1">•</span> {formatTime(schedule.race)}
                                </>
                            ) : 'Time TBA'}
                        </p>
                        <p className="text-highlight-silver mt-1 text-[10px]">Eastern Time</p>
                    </div>
                </div>

                {/* Session Timetable */}
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
                        <SessionRow label="Grand Prix" time={schedule?.race} isRace />
                    </div>
                </div>
            </div>
        </div>
    );
};

const SessionRow: React.FC<{ label: string; time?: string; highlight?: boolean; isRace?: boolean }> = ({ label, time, highlight, isRace }) => (
    <div className={`flex justify-between items-center ${isRace ? 'pt-2 mt-2 border-t border-pure-white/10' : ''}`}>
        <span className={`text-sm ${isRace ? 'font-bold text-primary-red uppercase' : (highlight ? 'font-semibold text-pure-white' : 'text-highlight-silver')}`}>
            {label}
        </span>
        <div className="text-right">
            <span className="block text-sm font-bold text-pure-white">{formatDate(time)}</span>
            <span className="block text-xs text-highlight-silver">{formatTime(time)}</span>
        </div>
    </div>
);

const CompactEventCard: React.FC<{ event: Event; schedule?: EventSchedule; isNext?: boolean }> = ({ event, schedule, isNext }) => (
    <div className={`flex flex-col p-4 rounded-xl border transition-colors h-full justify-between ${isNext ? 'bg-carbon-black border-primary-red shadow-lg shadow-primary-red/10' : 'bg-carbon-fiber border-pure-white/10 shadow-lg'}`}>
        <div>
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-highlight-silver uppercase">R{event.round}</span>
                {event.hasSprint && <SprintIcon className="w-4 h-4 text-yellow-500" />}
            </div>
            <h4 className="font-bold text-pure-white text-lg leading-tight mb-1 truncate">{event.country}</h4>
            <p className="text-xs text-highlight-silver truncate">{event.location}</p>
            <div className="flex items-center gap-1.5 mt-1 mb-3 opacity-70">
                <CircuitRoute eventId={event.id} className="w-4 h-4 text-highlight-silver" />
                <p className="text-[10px] text-highlight-silver truncate">{event.circuit}</p>
            </div>
        </div>
        
        <div className="mt-auto pt-3 border-t border-pure-white/10">
            <p className="text-[10px] text-highlight-silver uppercase mb-0.5">Race</p>
            <p className="font-bold text-sm text-pure-white">{schedule?.race ? formatDate(schedule.race) : 'TBA'}</p>
            <p className="text-xs text-primary-red font-mono">{schedule?.race ? formatTime(schedule.race) : '-'}</p>
        </div>
    </div>
);

const FullEventRow: React.FC<{ event: Event; schedule?: EventSchedule; isNext?: boolean }> = ({ event, schedule, isNext }) => (
    <div className={`flex items-center justify-between p-4 rounded-lg border ${isNext ? 'bg-pure-white/10 border-primary-red/50' : 'bg-accent-gray/20 border-pure-white/5 hover:bg-pure-white/5'}`}>
        <div className="flex items-center gap-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isNext ? 'bg-primary-red text-pure-white' : 'bg-carbon-black text-highlight-silver'}`}>
                {event.round}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="font-bold text-pure-white">{event.name}</h4>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-highlight-silver">
                    <span className="font-semibold text-ghost-white">{event.country}, {event.location}</span>
                    <span className="text-highlight-silver/50 hidden sm:inline">•</span>
                    <div className="flex items-center gap-1">
                        <CircuitRoute eventId={event.id} className="w-3 h-3 text-highlight-silver" />
                        <span className="truncate">{event.circuit}</span>
                    </div>
                    {event.hasSprint && (
                        <div className="flex items-center gap-1 ml-1 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded">
                            <SprintIcon className="w-3 h-3 text-yellow-500" />
                            <span className="text-yellow-500 font-bold uppercase text-[10px]">Sprint</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
        <div className="text-right pl-4">
            {schedule?.race ? (
                <>
                    <p className="font-bold text-pure-white text-sm">{formatDate(schedule.race)}</p>
                    <p className="text-xs text-highlight-silver font-mono">{formatTime(schedule.race)}</p>
                </>
            ) : (
                <span className="text-xs text-highlight-silver italic">TBA</span>
            )}
        </div>
    </div>
);

export default SchedulePage;
