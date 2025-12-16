
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
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

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
        <>
            <div className="max-w-7xl mx-auto w-full pb-20 md:pb-0 md:h-[calc(100vh-6rem)] md:overflow-hidden md:flex md:flex-col">
                <div className="flex-none flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-6 px-4 md:px-0 pt-4 md:pt-0 gap-4">
                    <div className="flex flex-col">
                        <h1 className="text-3xl font-bold text-pure-white flex items-center gap-3">
                            <CalendarIcon className="w-8 h-8 text-primary-red" />
                            Race Calendar
                        </h1>
                        <p className="text-xs text-highlight-silver mt-1 ml-11">All times displayed in EST</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
                        {/* Legend - Only show in full view */}
                        {viewMode === 'full' && (
                            <div className="hidden sm:flex items-center gap-3 bg-carbon-black/40 px-3 py-1.5 rounded-lg border border-pure-white/5">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-highlight-silver shadow-[0_0_5px_#C0C0C0]"></div>
                                    <span className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider">Race</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_5px_#EAB308]"></div>
                                    <span className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider">Sprint</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-primary-red shadow-[0_0_5px_#DA291C]"></div>
                                    <span className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider">Next</span>
                                </div>
                            </div>
                        )}

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
                        <div className="px-4 md:px-2 animate-fade-in-up flex-1 min-h-0 flex flex-col">
                            <h3 className="text-lg font-bold text-highlight-silver mb-3 uppercase tracking-wider flex-none">Next 5 Rounds</h3>
                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:h-full pb-2">
                                {upcomingRaces.map(event => (
                                    <div key={event.id} className="md:h-full">
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
                    </div>
                )}

                {/* Full Schedule List - Grid on Desktop */}
                {viewMode === 'full' && (
                    <div className="animate-fade-in md:flex-1 md:overflow-y-auto custom-scrollbar px-4 pb-6 md:p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {events.map(event => (
                                <EventGridCard 
                                    key={event.id} 
                                    event={event} 
                                    schedule={schedules[event.id]} 
                                    isNext={nextRace?.id === event.id} 
                                    onClick={() => setSelectedEvent(event)}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Event Detail Modal */}
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

// --- Sub-components ---

const formatDate = (isoString?: string) => {
    if (!isoString) return 'TBA';
    const date = new Date(isoString);
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
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'America/New_York'
    });
};

// Helper for styling
const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const NextRaceHero: React.FC<{ event: Event; schedule?: EventSchedule }> = ({ event, schedule }) => {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-carbon-fiber border border-pure-white/10 shadow-2xl">
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

const EventDetailsModal: React.FC<{ event: Event; schedule?: EventSchedule; onClose: () => void }> = ({ event, schedule, onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/80 backdrop-blur-sm p-4 animate-fade-in" onClick={onClose}>
            <div className="w-full max-w-4xl relative overflow-hidden rounded-2xl bg-carbon-fiber border border-pure-white/10 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-4 right-4 z-20 bg-carbon-black/50 hover:bg-carbon-black text-pure-white rounded-full p-2 transition-colors border border-pure-white/10">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                {/* Red Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary-red/20 via-transparent to-transparent pointer-events-none"></div>
                
                <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row gap-8 md:gap-12">
                    {/* Left Column: Event Info */}
                    <div className="flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-xs font-bold text-highlight-silver bg-carbon-black/50 border border-pure-white/10 px-3 py-1 rounded-full uppercase tracking-wider">
                                Round {event.round}
                            </span>
                            {event.hasSprint && (
                                <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 text-xs px-2 py-1 rounded-full border border-yellow-500/30 font-bold uppercase">
                                    <SprintIcon className="w-3 h-3 text-yellow-500" />
                                    Sprint Weekend
                                </div>
                            )}
                        </div>
                        
                        <h2 className="text-4xl md:text-5xl font-black text-pure-white mb-2 leading-none">{event.name}</h2>
                        <div className="flex flex-col gap-1 mb-8">
                            <p className="text-xl text-highlight-silver">
                                <span className="font-bold text-pure-white">{event.country}</span>, {event.location}
                            </p>
                            <div className="flex items-center gap-2 text-sm font-bold text-highlight-silver/70 mt-1">
                                <CircuitRoute eventId={event.id} className="w-5 h-5 text-highlight-silver" />
                                {event.circuit}
                            </div>
                        </div>
                        
                        {/* Main Race Time Hero */}
                        <div className="bg-carbon-black/60 p-5 rounded-xl border border-pure-white/10 backdrop-blur-md shadow-lg">
                            <p className="text-xs text-primary-red uppercase tracking-widest font-bold mb-2">Grand Prix Start</p>
                            <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4">
                                <span className="text-2xl md:text-3xl font-bold text-pure-white">
                                    {schedule?.race ? formatDate(schedule.race) : 'Date TBA'}
                                </span>
                                {schedule?.race && (
                                    <span className="text-xl md:text-3xl font-mono text-highlight-silver">
                                        {formatTime(schedule.race)}
                                    </span>
                                )}
                            </div>
                            <p className="text-highlight-silver/50 mt-1 text-[10px] uppercase tracking-wide">Eastern Standard Time</p>
                        </div>
                    </div>

                    {/* Right Column: Full Timetable */}
                    <div className="flex-1 bg-pure-white/5 backdrop-blur-sm rounded-xl p-6 border border-pure-white/5 shadow-lg">
                        <h3 className="text-sm font-bold text-pure-white uppercase tracking-wider mb-5 border-b border-pure-white/10 pb-3 flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-highlight-silver" /> Session Timetable
                        </h3>
                        <div className="space-y-4">
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
        </div>
    );
};

const SessionRow: React.FC<{ label: string; time?: string; highlight?: boolean; isRace?: boolean }> = ({ label, time, highlight, isRace }) => (
    <div className={`flex justify-between items-center ${isRace ? 'pt-3 mt-3 border-t border-pure-white/10' : ''}`}>
        <span className={`text-sm ${isRace ? 'font-bold text-primary-red uppercase tracking-wide' : (highlight ? 'font-bold text-pure-white' : 'font-medium text-highlight-silver')}`}>
            {label}
        </span>
        <div className="text-right">
            <span className={`block text-sm font-bold ${isRace ? 'text-pure-white text-base' : 'text-pure-white'}`}>{formatDate(time)}</span>
            <span className={`block text-xs font-mono ${isRace ? 'text-primary-red font-bold' : 'text-highlight-silver'}`}>{formatTime(time)}</span>
        </div>
    </div>
);

const CompactEventCard: React.FC<{ event: Event; schedule?: EventSchedule; isNext?: boolean; onClick: () => void }> = ({ event, schedule, isNext, onClick }) => (
    <button 
        onClick={onClick}
        className={`w-full text-left flex flex-col p-4 rounded-xl border transition-all duration-300 h-full justify-between group hover:scale-[1.02] ${isNext ? 'bg-carbon-black border-primary-red shadow-lg shadow-primary-red/10 hover:shadow-primary-red/20' : 'bg-carbon-fiber border-pure-white/10 shadow-lg hover:border-pure-white/30'}`}
    >
        <div className="w-full">
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
        
        <div className="mt-auto pt-3 border-t border-pure-white/10 w-full">
            <p className="text-[10px] text-highlight-silver uppercase mb-0.5">Race</p>
            <p className="font-bold text-sm text-pure-white">{schedule?.race ? formatDate(schedule.race) : 'TBA'}</p>
            <p className="text-xs text-primary-red font-mono">{schedule?.race ? formatTime(schedule.race) : '-'}</p>
        </div>
    </button>
);

const EventGridCard: React.FC<{ event: Event; schedule?: EventSchedule; isNext?: boolean; onClick: () => void }> = ({ event, schedule, isNext, onClick }) => {
    // Determine card accent color
    // Red for Next, Yellow for Sprint, Silver for default
    let accentColor = '#C0C0C0'; 
    if (event.hasSprint) accentColor = '#EAB308'; 
    if (isNext) accentColor = '#DA291C'; 

    const lockTime = schedule?.customLockAt || event.lockAtUtc;

    return (
        <button 
            onClick={onClick}
            className="w-full text-left relative overflow-hidden rounded-xl bg-carbon-black border transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl group flex flex-col h-full min-h-[160px] focus:outline-none focus:ring-2 focus:ring-pure-white/20"
            style={{ 
                borderColor: `${accentColor}60`, 
                boxShadow: isNext ? `0 0 20px ${hexToRgba(accentColor, 0.2)}` : `0 0 10px ${hexToRgba(accentColor, 0.05)}`
            }} 
        >
            {/* Color Flare Background */}
            <div 
                className="absolute inset-0 z-0 pointer-events-none opacity-10 transition-opacity duration-300 group-hover:opacity-25"
                style={{ background: `linear-gradient(135deg, ${accentColor} 0%, transparent 75%)` }}
            />

            <div className="relative z-10 p-4 flex flex-col h-full w-full">
                <div className="flex justify-between items-start mb-3 w-full">
                    <div className="flex flex-col overflow-hidden">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider">Round</span>
                            <span className="text-xl font-black text-pure-white leading-none">{event.round}</span>
                        </div>
                        <h3 className="text-lg font-bold text-pure-white leading-tight truncate">{event.name}</h3>
                        <p className="text-xs text-highlight-silver truncate">{event.location}, {event.country}</p>
                    </div>
                    
                    {/* Vertical Pill Indicator & Icon */}
                    <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                        {event.hasSprint && (
                            <SprintIcon className="w-6 h-6 text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" />
                        )}
                        <div 
                            className="w-1.5 h-8 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" 
                            style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }} 
                        />
                    </div>
                </div>

                <div className="mt-auto w-full space-y-2">
                    {/* Picks Due Row */}
                    <div className="pt-2 border-t border-pure-white/10 flex items-end justify-between w-full">
                        <div>
                            <p className="text-[10px] text-primary-red uppercase mb-0.5 font-bold">Picks Due</p>
                            <p className="font-bold text-sm text-ghost-white">
                                {formatDate(lockTime)}
                            </p>
                        </div>
                        <div className="text-right">
                             <p className="font-mono text-sm font-bold text-highlight-silver group-hover:text-pure-white transition-colors">
                                {formatTime(lockTime)}
                            </p>
                        </div>
                    </div>

                    {/* Grand Prix Row */}
                    <div className="pt-2 border-t border-pure-white/5 flex items-end justify-between w-full opacity-80 group-hover:opacity-100 transition-opacity">
                        <div>
                            <p className="text-[10px] text-highlight-silver uppercase mb-0.5">Grand Prix</p>
                            <p className={`font-bold text-sm ${isNext ? 'text-pure-white' : 'text-ghost-white'}`}>
                                {schedule?.race ? formatDate(schedule.race) : 'TBA'}
                            </p>
                        </div>
                        <div className="text-right">
                             <p className={`font-mono text-lg font-bold ${isNext ? 'text-primary-red' : 'text-highlight-silver group-hover:text-pure-white transition-colors'}`}>
                                {schedule?.race ? formatTime(schedule.race) : '-'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </button>
    );
};

export default SchedulePage;
