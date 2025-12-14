
import React, { useState, useMemo } from 'react';
import { Event, EventSchedule } from '../types.ts';
import { EVENTS } from '../constants.ts';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';

interface SchedulePageProps {
    schedules: { [eventId: string]: EventSchedule };
}

const SchedulePage: React.FC<SchedulePageProps> = ({ schedules }) => {
    const [viewMode, setViewMode] = useState<'upcoming' | 'full'>('upcoming');

    const nextRace = useMemo(() => {
        const now = new Date();
        // Find first race where race time is in future OR lock time is in future
        return EVENTS.find(e => {
            const sched = schedules[e.id];
            const raceTime = sched?.race ? new Date(sched.race) : new Date(e.lockAtUtc); // Fallback to lock time if no specific race time
            // Add 2 hours for race duration roughly to keep showing it while live
            const raceEndTime = new Date(raceTime.getTime() + 2 * 60 * 60 * 1000); 
            return raceEndTime > now;
        });
    }, [schedules]);

    const upcomingRaces = useMemo(() => {
        if (!nextRace) return [];
        const idx = EVENTS.findIndex(e => e.id === nextRace.id);
        return EVENTS.slice(idx, idx + 5);
    }, [nextRace]);

    return (
        <div className="max-w-7xl mx-auto w-full pb-20 md:pb-0 md:h-[calc(100vh-5rem)] md:overflow-hidden md:flex md:flex-col">
            <div className="flex-none flex items-center justify-between mb-6 px-4 md:px-0 pt-4 md:pt-0">
                <h1 className="text-3xl font-bold text-pure-white flex items-center gap-3">
                    <CalendarIcon className="w-8 h-8 text-primary-red" />
                    Race Calendar
                </h1>
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
                        <div className="px-4 md:px-0 mb-8 animate-fade-in flex-none">
                            <NextRaceHero event={nextRace} schedule={schedules[nextRace.id]} />
                        </div>
                    )}

                    {/* Next 5 List */}
                    <div className="px-4 md:px-0 animate-fade-in-up flex-1 min-h-0 flex flex-col">
                        <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider flex-none">Next 5 Rounds</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:h-full overflow-y-auto md:overflow-visible pb-4 md:pb-0">
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
                <div className="px-4 md:px-0 space-y-3 animate-fade-in md:flex-1 md:overflow-y-auto custom-scrollbar md:pr-2">
                    {EVENTS.map(event => (
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
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const NextRaceHero: React.FC<{ event: Event; schedule?: EventSchedule }> = ({ event, schedule }) => {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-carbon-black border border-pure-white/10 shadow-2xl">
            {/* Background Texture */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary-red/10 to-transparent pointer-events-none"></div>
            
            <div className="relative z-10 p-6 md:p-8 flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                    <div className="inline-block bg-primary-red text-pure-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-4">
                        Next Grand Prix
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-pure-white mb-2 leading-none">{event.name}</h2>
                    <div className="flex items-center gap-2 text-xl text-highlight-silver mb-6">
                        <TrackIcon className="w-5 h-5" />
                        <span>{event.country}</span>
                        {event.hasSprint && <span className="bg-yellow-500/20 text-yellow-500 text-xs px-2 py-0.5 rounded border border-yellow-500/30 ml-2 font-bold uppercase">Sprint</span>}
                    </div>
                    
                    {/* Main Countdown or Date */}
                    <div className="bg-carbon-black/50 p-4 rounded-xl border border-pure-white/10 inline-block">
                        <p className="text-xs text-highlight-silver uppercase tracking-widest mb-1">Lights Out</p>
                        <p className="text-2xl md:text-3xl font-bold text-pure-white">
                            {schedule?.race ? (
                                <>
                                    {formatDate(schedule.race)} <span className="text-primary-red mx-1">•</span> {formatTime(schedule.race)}
                                </>
                            ) : 'Time TBA'}
                        </p>
                        <p className="text-[10px] text-highlight-silver mt-1">Your Local Time</p>
                    </div>
                </div>

                {/* Session Timetable */}
                <div className="flex-1 bg-pure-white/5 rounded-xl p-5 border border-pure-white/5">
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
    <div className={`flex flex-col p-4 rounded-xl border transition-colors h-full justify-between ${isNext ? 'bg-carbon-black border-primary-red shadow-lg shadow-primary-red/10' : 'bg-accent-gray/30 border-pure-white/5'}`}>
        <div>
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-bold text-highlight-silver uppercase">R{event.round}</span>
                {event.hasSprint && <SprintIcon className="w-4 h-4 text-yellow-500" />}
            </div>
            <h4 className="font-bold text-pure-white text-lg leading-tight mb-1 truncate">{event.country}</h4>
            <p className="text-xs text-highlight-silver mb-3 truncate">{event.name}</p>
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
            <div>
                <h4 className="font-bold text-pure-white">{event.name}</h4>
                <div className="flex items-center gap-2 text-xs text-highlight-silver">
                    <span>{event.country}</span>
                    {event.hasSprint && <span className="text-yellow-500 font-bold">• Sprint</span>}
                </div>
            </div>
        </div>
        <div className="text-right">
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
