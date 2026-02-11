
import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { calculateScoreRollup, calculatePointsForEvent, processLeaderboardStats } from '../services/scoringService.ts';
import { User, RaceResults, PickSelection, PointsSystem, Event, Driver, Constructor, EventResult, LeaderboardCache } from '../types.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { TrendingUpIcon } from './icons/TrendingUpIcon.tsx';
import { LightbulbIcon } from './icons/LightbulbIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { ListSkeleton, ProfileSkeleton } from './LoadingSkeleton.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import { PageHeader } from './ui/PageHeader.tsx';
import { DEFAULT_PAGE_SIZE, getAllUsersAndPicks, fetchAllUserPicks, getUserPicks } from '../services/firestoreService.ts';
import ProfilePage from './ProfilePage.tsx';

// --- Configuration ---
const REFRESH_COOLDOWN_SECONDS = 60;
const MAX_DAILY_REFRESHES = 5;
const LOCKOUT_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// --- Shared Types & Helpers ---

type ViewState = 'menu' | 'standings' | 'popular' | 'insights' | 'entities' | 'p22';

type ProcessedUser = User;

interface RefreshPolicy {
    count: number;
    lastRefresh: number;
    dayStart: number;
    lockedUntil: number;
}

interface LeaderboardPageProps {
  currentUser: User | null;
  raceResults: RaceResults;
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
  leaderboardCache: LeaderboardCache | null;
  refreshLeaderboard: () => Promise<void>;
  resetToken?: number; // New prop to trigger menu reset
}

const getEntityName = (id: string, allDrivers: Driver[], allConstructors: Constructor[]) => {
    return allDrivers.find(d => d.id === id)?.name || allConstructors.find(c => c.id === id)?.name || id;
};

// --- Sub-Components ---

const RefreshControl: React.FC<{ 
    onClick: () => void; 
    isRefreshing: boolean; 
    cooldown: number;
    status: 'idle' | 'success' | 'error';
    dailyCount: number;
}> = ({ onClick, isRefreshing, cooldown, status, dailyCount }) => {
    
    const formatCooldown = (secs: number) => {
        if (secs < 60) return `${secs}s`;
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m ${s}s`;
    };

    const isLocked = cooldown > 610; // Consider it a "Lock" if wait is > 1 hour
    const remainingDaily = Math.max(0, MAX_DAILY_REFRESHES - dailyCount);

    return (
        <div className="relative flex items-center justify-center">
            {status !== 'idle' && (
                <div className={`
                    absolute right-full mr-3 whitespace-nowrap px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg animate-fade-in
                    ${status === 'success' ? 'bg-green-500 text-carbon-black' : 'bg-red-500 text-pure-white'}
                `}>
                    {status === 'success' ? 'Data Updated ✓' : 'Update Failed ✕'}
                </div>
            )}

            <button 
                onClick={onClick}
                disabled={isRefreshing || cooldown > 0}
                className={`
                    flex items-center justify-center gap-2 p-2 rounded-lg transition-all duration-200 border min-w-[100px]
                    ${(isRefreshing || cooldown > 0)
                        ? 'bg-carbon-black border-accent-gray text-highlight-silver/50 cursor-not-allowed'
                        : 'bg-carbon-black border-accent-gray text-highlight-silver hover:text-pure-white hover:border-primary-red hover:shadow-[0_0_10px_rgba(218,41,28,0.2)]'
                    }
                `}
                title={cooldown > 0 ? (isLocked ? "Daily Limit Reached" : "Cooling Down") : `${remainingDaily} refreshes remaining today`}
            >
                {cooldown > 0 ? (
                    <div className="flex flex-col items-center justify-center leading-none px-2 py-0.5">
                        {isLocked && <span className="text-[8px] font-black uppercase tracking-widest text-red-500 mb-0.5">LOCKED</span>}
                        <span className={`font-mono font-bold text-center ${isLocked ? 'text-xs text-pure-white' : 'text-xs'}`}>
                            {formatCooldown(cooldown)}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 px-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isRefreshing ? 'animate-spin text-primary-red' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-sm font-bold uppercase">Refresh</span>
                        <span className="text-[9px] bg-pure-white/10 px-1.5 py-0.5 rounded-full text-highlight-silver ml-1 font-mono">
                            {remainingDaily}
                        </span>
                    </div>
                )}
            </button>
        </div>
    );
};

const NavTile: React.FC<{ icon: any; title: string; subtitle: string; desc: string; onClick: () => void; delay?: string }> = ({ icon: Icon, title, subtitle, desc, onClick, delay = '0ms' }) => (
    <button
        onClick={onClick}
        className="group relative overflow-hidden rounded-xl p-6 text-left border border-pure-white/10 hover:border-primary-red/50 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col w-full min-h-[220px] bg-carbon-fiber animate-fade-in-up"
        style={{ animationDelay: delay }}
    >
        {/* Background Icon (Huge & Faded) */}
        <div className="absolute -bottom-6 -right-6 p-0 opacity-[0.03] transition-all transform duration-500 pointer-events-none group-hover:scale-110 group-hover:rotate-12 group-hover:opacity-10 text-pure-white">
            <Icon className="w-48 h-48" />
        </div>
        
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4 relative z-10">
             <div className="w-12 h-12 rounded-lg flex items-center justify-center transition-colors shadow-lg border bg-carbon-black/50 text-primary-red border-pure-white/5 group-hover:bg-primary-red/20">
                <Icon className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider bg-carbon-black/30 px-2 py-1 rounded border border-pure-white/5">{subtitle}</p>
        </div>
        
        {/* Content Section */}
        <div className="relative z-10 flex-grow flex flex-col justify-center">
            <h3 className="text-2xl font-bold mb-2 transition-colors leading-none text-pure-white group-hover:text-primary-red">{title}</h3>
            <p className="text-highlight-silver/70 text-sm leading-snug">{desc}</p>
        </div>
        
        {/* Footer Action */}
        <div className="mt-4 pt-4 border-t border-pure-white/5 flex items-center justify-between text-xs font-bold text-pure-white opacity-60 group-hover:opacity-100 transition-opacity relative z-10">
            <span>Access</span>
            <span className="text-primary-red transform group-hover:translate-x-1 transition-transform">&rarr;</span>
        </div>
    </button>
);

const SimpleBarChart: React.FC<{ data: { label: string; value: number; color?: string }[]; max?: number }> = ({ data, max }) => {
    const maxValue = max || Math.max(...data.map(d => d.value), 1);
    return (
        <div className="space-y-3">
            {data.map((item, idx) => {
                const isHex = item.color?.startsWith('#');
                return (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                        <span className="w-24 md:w-32 text-left truncate font-semibold text-highlight-silver text-xs md:text-sm">{item.label}</span>
                        <div className="flex-1 h-3 md:h-4 bg-carbon-black rounded-full overflow-hidden border border-pure-white/5">
                            <div 
                                className={`h-full rounded-full ${!item.color ? 'bg-primary-red' : (isHex ? '' : item.color)}`} 
                                style={{ 
                                    width: `${(item.value / maxValue) * 100}%`,
                                    backgroundColor: isHex ? item.color : undefined 
                                }} 
                            />
                        </div>
                        <span className="w-8 md:w-12 font-bold text-pure-white text-right text-xs md:text-sm">{item.value}</span>
                    </div>
                );
            })}
        </div>
    );
};

const ConstructorPodium: React.FC<{ data: { label: string; value: number; color?: string }[] }> = ({ data }) => {
    if (data.length === 0) return <p className="text-highlight-silver italic">No points scored yet.</p>;

    const top3 = data.slice(0, 3);
    const rest = data.slice(3);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex justify-center items-end gap-2 md:gap-6 h-56 md:h-72 pt-4 pb-0 relative">
                 {data[1] && (
                    <div className="flex flex-col items-center w-1/3 max-w-[120px] animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                        <div className="mb-2 text-center">
                            <span className="block text-xs md:text-sm font-bold text-highlight-silver truncate w-full">{data[1].label}</span>
                            <span className="block text-lg md:text-xl font-black text-pure-white">{data[1].value}</span>
                        </div>
                        <div 
                            className="w-full h-28 md:h-40 rounded-t-lg relative shadow-lg" 
                            style={{ 
                                backgroundColor: `${data[1].color || '#333'}80`, 
                                borderTop: `4px solid ${data[1].color || '#555'}`,
                                boxShadow: `0 0 15px ${data[1].color}20`
                            }}
                        >
                             <div className="absolute bottom-3 w-full text-center text-xs font-bold text-pure-white/60 uppercase tracking-widest">2nd</div>
                        </div>
                    </div>
                 )}
                 
                 {data[0] && (
                    <div className="flex flex-col items-center w-1/3 max-w-[140px] z-10 -mx-1 animate-fade-in-up">
                        <div className="mb-3 text-center">
                            <div className="text-yellow-400 mb-1 drop-shadow-md"><TrophyIcon className="w-8 h-8 mx-auto"/></div>
                            <span className="block text-sm md:text-base font-bold text-pure-white truncate w-full">{data[0].label}</span>
                            <span className="block text-2xl md:text-4xl font-black text-primary-red drop-shadow-sm">{data[0].value}</span>
                        </div>
                        <div 
                            className="w-full h-36 md:h-52 rounded-t-lg relative shadow-2xl" 
                            style={{ 
                                backgroundColor: `${data[0].color || '#333'}`, 
                                borderTop: `4px solid ${data[0].color || '#555'}`,
                                boxShadow: `0 0 30px ${data[0].color}40`
                            }}
                        >
                             <div className="absolute bottom-4 w-full text-center text-sm font-black text-pure-white uppercase tracking-widest">1st</div>
                        </div>
                    </div>
                 )}
                 
                 {data[2] && (
                    <div className="flex flex-col items-center w-1/3 max-w-[120px] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                        <div className="mb-2 text-center">
                            <span className="block text-xs md:text-sm font-bold text-highlight-silver truncate w-full">{data[2].label}</span>
                            <span className="block text-lg md:text-xl font-black text-pure-white">{data[2].value}</span>
                        </div>
                        <div 
                            className="w-full h-20 md:h-28 rounded-t-lg relative shadow-lg" 
                            style={{ 
                                backgroundColor: `${data[2].color || '#333'}80`, 
                                borderTop: `4px solid ${data[2].color || '#555'}`,
                                boxShadow: `0 0 15px ${data[2].color}20`
                            }}
                        >
                             <div className="absolute bottom-3 w-full text-center text-xs font-bold text-pure-white/60 uppercase tracking-widest">3rd</div>
                        </div>
                    </div>
                 )}
            </div>

            {rest.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-pure-white/10">
                    {rest.map((team, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-3 bg-carbon-black/40 rounded-lg border border-pure-white/5 hover:border-pure-white/20 transition-colors">
                            <div className="w-8 text-center font-mono text-highlight-silver font-bold text-sm bg-pure-white/5 rounded py-1">{idx + 4}</div>
                            <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: team.color, boxShadow: `0 0 8px ${team.color}60` }}></div>
                            <div className="flex-1 font-bold text-sm text-pure-white">{team.label}</div>
                            <div className="font-mono font-bold text-pure-white text-lg">{team.value} <span className="text-[10px] text-highlight-silver font-normal uppercase">pts</span></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const RaceChart: React.FC<{ users: ProcessedUser[], hasMore: boolean, onFetchMore: () => void, isPaging: boolean, onSelectUser?: (user: ProcessedUser) => void }> = ({ users, hasMore, onFetchMore, isPaging, onSelectUser }) => {
    // Safety check: ensure users is defined
    if (!users || users.length === 0) return null;

    const maxPoints = Math.max(...users.map(u => u.totalPoints || 0), 1);
    
    return (
        <div className="w-full py-2 px-1 md:px-2 md:py-4 pt-12 md:pt-16">
            <div className="relative">
                {/* Finish Line Icon */}
                <div className="absolute -top-10 right-10 md:right-14 transform translate-x-1/2 z-0">
                     <CheckeredFlagIcon className="w-8 h-8 text-pure-white opacity-50" />
                </div>

                <div className="absolute top-0 bottom-0 right-10 md:right-14 w-px border-r-2 border-dashed border-pure-white/10 z-0"></div>

                <div className="space-y-1 relative z-10 pb-8 pt-4">
                    {users.map((user, idx) => {
                        const points = user.totalPoints || 0;
                        const rank = user.rank || idx + 1;
                        const percent = (points / maxPoints) * 100;
                        
                        let carColor = "text-primary-red"; 
                        let rankColor = "text-highlight-silver";
                        
                        if (rank === 1) {
                            carColor = "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]";
                            rankColor = "text-yellow-400";
                        } else if (rank === 2) {
                            carColor = "text-gray-300 drop-shadow-[0_0_10px_rgba(209,213,219,0.6)]";
                            rankColor = "text-gray-300";
                        } else if (rank === 3) {
                            carColor = "text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.6)]";
                            rankColor = "text-orange-400";
                        }

                        // Safe display name handling
                        const displayName = user.displayName || "Unknown Team";
                        const shortName = displayName.length > 12 ? `${displayName.substring(0, 12)}...` : displayName;

                        return (
                            <div key={user.id} className="flex items-center gap-2 md:gap-3 h-10 md:h-12 group hover:bg-pure-white/5 rounded-lg px-1 md:px-2 transition-colors">
                                <div className={`w-6 md:w-8 text-center font-black text-sm md:text-lg ${rankColor} shrink-0`}>
                                    {rank}
                                </div>
                                <div className="w-24 md:w-60 text-left font-semibold md:font-bold text-[10px] md:text-sm text-highlight-silver group-hover:text-pure-white transition-colors shrink-0">
                                    <span className="md:hidden">
                                        {shortName}
                                    </span>
                                    <span className="hidden md:inline truncate">
                                        {displayName}
                                    </span>
                                </div>
                                <div className="flex-1 relative h-full flex items-center ml-4 md:ml-6 mr-1 md:mr-2">
                                    <div className="absolute left-0 right-0 h-px bg-pure-white/10 w-full rounded-full"></div>
                                    <div 
                                        className="relative h-full flex items-center justify-end transition-all duration-1000 ease-out pr-6 md:pr-14 cursor-pointer"
                                        style={{ width: `${percent}%` }}
                                        onClick={() => onSelectUser?.(user)}
                                    >
                                        <div className="relative group/car">
                                            <F1CarIcon className={`w-6 h-6 md:w-8 md:h-8 transform -rotate-90 ${carColor} transition-transform group-hover/car:scale-125`} />
                                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/car:opacity-10 whitespace-nowrap pointer-events-none transition-opacity font-bold uppercase tracking-wider shadow-lg border border-pure-white/10 z-20">
                                                Inspect
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-8 md:w-12 text-right font-mono font-bold text-xs md:text-sm text-pure-white shrink-0">
                                    {points}
                                </div>
                            </div>
                        );
                    })}

                    {/* Pagination [S1C-01] */}
                    {hasMore && (
                        <div className="flex justify-center pt-8">
                            <button 
                                // Fix: use onFetchMore from props instead of handleFetchMore
                                onClick={onFetchMore}
                                disabled={isPaging}
                                className="bg-carbon-black hover:bg-accent-gray text-pure-white font-bold py-2.5 px-8 rounded-lg border border-pure-white/10 shadow-lg flex items-center gap-3 transition-all transform active:scale-95"
                            >
                                {isPaging ? (
                                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <CheckeredFlagIcon className="w-5 h-5 text-primary-red" />
                                )}
                                Load More Grid
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Views ---

const StandingsView: React.FC<{ 
    users: ProcessedUser[]; 
    currentUser: User | null;
    hasMore: boolean;
    onFetchMore: () => void;
    isPaging: boolean;
    onSelectUser: (user: ProcessedUser) => void;
}> = ({ users, currentUser, hasMore, onFetchMore, isPaging, onSelectUser }) => {
    
    return (
        <div className="flex flex-col md:h-full animate-fade-in pb-safe overflow-hidden">
            <div className="flex flex-col md:h-full bg-carbon-fiber border border-pure-white/10 rounded-xl overflow-hidden shadow-2xl">
                <div className="md:flex-1 md:overflow-y-auto custom-scrollbar p-4 md:min-h-0 pb-24 md:pb-4">
                    <RaceChart users={users} hasMore={hasMore} onFetchMore={onFetchMore} isPaging={isPaging} onSelectUser={onSelectUser} />
                </div>
            </div>
        </div>
    );
};

const PopularityView: React.FC<{ 
    allLeaguePicks: { [uid: string]: { [eid: string]: PickSelection } }; 
    allDrivers: Driver[]; 
    allConstructors: Constructor[]; 
    events: Event[];
    isLoading?: boolean;
}> = ({ allLeaguePicks, allDrivers, allConstructors, events, isLoading }) => {
    const [timeRange, setTimeRange] = useState<'all' | '30' | '60' | '90'>('all');

    const stats = useMemo(() => {
        const teamCounts: { [id: string]: number } = {};
        allConstructors.forEach(c => teamCounts[c.id] = 0);
        const driverCounts: { [id: string]: number } = {};
        allDrivers.forEach(d => driverCounts[d.id] = 0);

        if (Object.keys(allLeaguePicks).length === 0) return { teams: [], leastTeams: [], drivers: [], leastDrivers: [] };

        const eventIdsWithPicks = new Set<string>();
        Object.values(allLeaguePicks).forEach(userPicks => {
            Object.keys(userPicks).forEach(eid => eventIdsWithPicks.add(eid));
        });

        const completedEvents = events.filter(e => eventIdsWithPicks.has(e.id)).sort((a, b) => new Date(a.lockAtUtc).getTime() - new Date(b.lockAtUtc).getTime());
        
        let relevantEvents: Event[] = completedEvents;
        if (timeRange === '30' && completedEvents.length > 0) relevantEvents = completedEvents.slice(-3); 
        if (timeRange === '60' && completedEvents.length > 0) relevantEvents = completedEvents.slice(-5);
        if (timeRange === '90' && completedEvents.length > 0) relevantEvents = completedEvents.slice(-8);
        
        const relevantEventIds = new Set(relevantEvents.map(e => e.id));

        Object.values(allLeaguePicks).forEach(userPicks => {
            Object.entries(userPicks).forEach(([eventId, picks]) => {
                if (!relevantEventIds.has(eventId)) return;
                const teams = [...(picks.aTeams || []), picks.bTeam].filter(Boolean) as string[];
                const drivers = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean) as string[];
                teams.forEach(t => { if(teamCounts[t] !== undefined) teamCounts[t]++ });
                drivers.forEach(d => { if(driverCounts[d] !== undefined) driverCounts[d]++ });
            });
        });

        const getColor = (id: string, type: 'team' | 'driver') => {
            if (type === 'team') {
                const team = allConstructors.find(c => c.id === id);
                return team?.color || CONSTRUCTORS.find(c => c.id === id)?.color;
            } else {
                const driver = allDrivers.find(d => d.id === id);
                if (!driver) return undefined;
                const team = allConstructors.find(c => c.id === driver.constructorId);
                return team?.color || CONSTRUCTORS.find(c => c.id === driver.constructorId)?.color;
            }
        };

        const sortAndMap = (counts: { [id: string]: number }, order: 'desc' | 'asc', type: 'team' | 'driver') => 
            Object.entries(counts)
                .map(([id, val]) => ({ 
                    label: getEntityName(id, allDrivers, allConstructors), 
                    value: val, 
                    color: getColor(id, type)
                }))
                .filter(item => item.value > 0 || order === 'asc') 
                .sort((a, b) => order === 'desc' ? b.value - a.value : a.value - b.value)
                .slice(0, 5);

        return {
            teams: sortAndMap(teamCounts, 'desc', 'team'),
            leastTeams: sortAndMap(teamCounts, 'asc', 'team'),
            drivers: sortAndMap(driverCounts, 'desc', 'driver'),
            leastDrivers: sortAndMap(driverCounts, 'asc', 'driver')
        };
    }, [allLeaguePicks, timeRange, allDrivers, allConstructors, events]);

    if (isLoading) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                <div className="bg-primary-red/10 p-6 rounded-full mb-4 animate-pulse">
                    <TrendingUpIcon className="w-12 h-12 text-primary-red" />
                </div>
                <h3 className="text-xl font-bold text-pure-white mb-2">Analyzing League Trends...</h3>
                <p className="text-highlight-silver max-sm">Fetching and calculating popularity data from the entire league roster.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:h-full animate-fade-in gap-4 pt-2 pb-4 md:overflow-hidden">
             <div className="flex-none flex flex-col md:flex-row justify-end items-center gap-4">
                <div className="flex bg-carbon-fiber border border-pure-white/10 rounded-lg p-1 w-full md:w-auto overflow-x-auto">
                    {(['all', '30', '60', '90'] as const).map(range => (
                         <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-1.5 rounded-md text-xs md:text-sm font-bold transition-colors whitespace-nowrap flex-1 ${
                                timeRange === range ? 'bg-primary-red text-pure-white' : 'text-highlight-silver hover:text-pure-white hover:bg-white/5'
                            }`}
                        >
                            {range === 'all' ? 'Season' : `Last ${range} Days`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="md:flex-1 md:overflow-y-auto custom-scrollbar pr-1 pb-24 md:pb-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6">
                    <div className="bg-carbon-fiber rounded-lg p-5 ring-1 ring-pure-white/10 shadow-lg border border-pure-white/5">
                        <h3 className="text-sm font-bold text-highlight-silver mb-4 uppercase tracking-wider">Most Picked Teams</h3>
                        <SimpleBarChart data={stats.teams} />
                    </div>
                    <div className="bg-carbon-fiber rounded-lg p-5 ring-1 ring-pure-white/10 shadow-lg border border-pure-white/5">
                        <h3 className="text-sm font-bold text-highlight-silver mb-4 uppercase tracking-wider">Most Picked Drivers</h3>
                        <SimpleBarChart data={stats.drivers} />
                    </div>
                    <div className="bg-carbon-fiber rounded-lg p-5 ring-1 ring-pure-white/10 shadow-lg border border-pure-white/5">
                        <h3 className="text-sm font-bold text-highlight-silver mb-4 uppercase tracking-wider">Least Picked Teams</h3>
                        <SimpleBarChart data={stats.leastTeams} max={Math.max(...stats.teams.map(t => t.value), 1)} />
                    </div>
                    <div className="bg-carbon-fiber rounded-lg p-5 ring-1 ring-pure-white/10 shadow-lg border border-pure-white/5">
                        <h3 className="text-sm font-bold text-highlight-silver mb-4 uppercase tracking-wider">Least Picked Drivers</h3>
                        <SimpleBarChart data={stats.leastDrivers} max={Math.max(...stats.drivers.map(d => d.value), 1)} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Enhanced Superlative Card & TrendChart for Insights ---

type InsightVariant = 'gp' | 'quali' | 'sprint' | 'fl';

const categories = [
    { key: 'gp' as const, shortLabel: 'Race', icon: CheckeredFlagIcon, fullTitle: 'Race Day Dominator', listTitle: 'Sunday Specialists (Top 10 GP Points)' },
    { key: 'quali' as const, shortLabel: 'Quali', icon: PolePositionIcon, fullTitle: 'Qualifying King', listTitle: 'Qualifying Masters (Top 10 Quali Points)' },
    { key: 'sprint' as const, shortLabel: 'Sprint', icon: SprintIcon, fullTitle: 'Sprint Specialist', listTitle: 'Sprint Specialists (Top 10 Sprint Points)' },
    { key: 'fl' as const, shortLabel: 'FL', icon: FastestLapIcon, fullTitle: 'Fastest Lap Hunter', listTitle: 'Fastest Lap Hunters (Top 10 FL Points)' },
];

const getVariantTheme = (variant: InsightVariant) => {
    switch (variant) {
        case 'gp': return { color: 'text-primary-red', border: 'border-primary-red', ring: 'ring-primary-red', bg: 'bg-primary-red', gradient: 'from-primary-red/20' };
        case 'quali': return { color: 'text-blue-500', border: 'border-blue-500', ring: 'ring-blue-500', bg: 'bg-blue-500', gradient: 'from-blue-500/20' };
        case 'sprint': return { color: 'text-yellow-500', border: 'border-yellow-500', ring: 'ring-yellow-500', bg: 'bg-yellow-500', gradient: 'from-yellow-500/20' };
        case 'fl': return { color: 'text-purple-500', border: 'border-purple-500', ring: 'ring-purple-500', bg: 'bg-purple-500', gradient: 'from-purple-500/20' };
        default: return { color: 'text-pure-white', border: 'border-pure-white', ring: 'ring-pure-white', bg: 'bg-pure-white', gradient: 'from-pure-white/20' };
    }
};

const SuperlativeCard: React.FC<{ 
    title: string; 
    icon: any; 
    data: { user: ProcessedUser; score: number } | null; 
    variant: InsightVariant;
    isActive: boolean;
    onClick: () => void;
}> = ({ title, icon: Icon, data, variant, isActive, onClick }) => {
    const theme = getVariantTheme(variant);
    
    return (
        <button 
            onClick={onClick}
            className={`
                group relative overflow-hidden rounded-xl p-5 shadow-lg h-full text-left transition-all duration-300 w-full flex flex-col justify-between
                ${isActive 
                    ? `bg-carbon-fiber ring-2 ${theme.ring} scale-[1.02] opacity-100 z-10 border border-transparent` 
                    : 'bg-carbon-fiber ring-1 ring-pure-white/10 opacity-70 hover:opacity-100 hover:scale-[1.01] border border-pure-white/5'
                }
            `}
        >
            {/* Background Gradient & Pattern */}
            <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${isActive ? 'opacity-100' : ''}`}></div>
            <div className="absolute inset-0 bg-checkered-flag opacity-[0.03] pointer-events-none"></div>
            
            <div className="relative z-10 flex items-start justify-between w-full">
                <div className="min-w-0 flex-1 mr-2">
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`p-2 rounded-lg bg-carbon-black border border-pure-white/10 ${theme.color} shadow-inner`}>
                            <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${theme.color} opacity-80 truncate`}>{title}</span>
                    </div>
                    
                    {data ? (
                        <div className="mt-1">
                            <p className="text-lg font-bold text-pure-white truncate leading-tight mb-1">{data.user.displayName}</p>
                            <p className={`text-3xl font-black font-mono ${theme.color} drop-shadow-sm leading-none`}>
                                {Number(data.score || 0).toLocaleString()} <span className="text-[10px] font-bold text-highlight-silver uppercase align-top ml-0.5">pts</span>
                            </p>
                        </div>
                    ) : (
                        <div className="mt-4">
                            <p className="text-sm text-highlight-silver italic opacity-50">No data available yet</p>
                        </div>
                    )}
                </div>
                
                {/* Rank Badge */}
                {data && (
                    <div className="text-right flex-shrink-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm bg-carbon-black border ${theme.border} ${theme.color} shadow-lg`}>
                            1
                        </div>
                    </div>
                )}
            </div>
            
            {/* Active Indicator */}
            {isActive && (
                <div className={`absolute bottom-0 left-0 right-0 h-1 ${theme.bg}`}></div>
            )}
        </button>
    );
};

const InsightsView: React.FC<{ 
    users: ProcessedUser[]; 
    allPicks: { [uid: string]: { [eid: string]: PickSelection } }; 
    raceResults: RaceResults;
    pointsSystem: PointsSystem;
    allDrivers: Driver[];
    events: Event[];
}> = ({ users, allPicks, raceResults, pointsSystem, allDrivers, events }) => {
    
    const [activeCategory, setActiveCategory] = useState<'gp' | 'quali' | 'sprint' | 'fl'>('gp');

    const findMax = (key: 'gp' | 'quali' | 'sprint' | 'fl') => {
        const validUsers = users.filter(u => u.breakdown && typeof u.breakdown[key] === 'number');
        if (validUsers.length === 0) return null;
        const sorted = [...validUsers].sort((a, b) => (b.breakdown?.[key] || 0) - (a.breakdown?.[key] || 0));
        if ((sorted[0].breakdown?.[key] || 0) <= 0) return null;
        return { user: sorted[0], score: sorted[0].breakdown![key] };
    };

    const superlatives = useMemo(() => {
        if (users.length === 0) return null;
        return { 
            gp: findMax('gp'), 
            quali: findMax('quali'), 
            sprint: findMax('sprint'), 
            fl: findMax('fl') 
        };
    }, [users]);

    const top10List = useMemo(() => {
        return [...users]
            .filter(u => u.breakdown && typeof u.breakdown[activeCategory] === 'number')
            .sort((a, b) => (b.breakdown![activeCategory] || 0) - (a.breakdown![activeCategory] || 0))
            .slice(0, 10);
    }, [users, activeCategory]);

    const activeTheme = getVariantTheme(activeCategory);
    const activeCategoryData = categories.find(c => c.key === activeCategory);

    return (
        <div className="flex flex-col md:h-full gap-4 animate-fade-in pb-24 md:pb-safe pt-2 md:overflow-y-auto custom-scrollbar pr-1">
            
            {/* DESKTOP: Superlative Cards Grid */}
            <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mx-1">
                {categories.map(cat => (
                    <SuperlativeCard 
                        key={cat.key}
                        title={cat.fullTitle} 
                        icon={cat.icon} 
                        data={superlatives?.[cat.key] || null} 
                        variant={cat.key} 
                        isActive={activeCategory === cat.key}
                        onClick={() => setActiveCategory(cat.key)}
                    />
                ))}
            </div>

            {/* MOBILE: Sticky Scrollable Pills */}
            <div className="md:hidden sticky top-0 z-20 bg-carbon-black/90 backdrop-blur-sm -mx-4 px-4 py-3 border-b border-pure-white/10">
                <div className="flex overflow-x-auto gap-2 no-scrollbar snap-x snap-mandatory">
                    {categories.map(cat => {
                        const theme = getVariantTheme(cat.key);
                        const leaderData = superlatives?.[cat.key];
                        const isActive = activeCategory === cat.key;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => setActiveCategory(cat.key)}
                                className={`flex-none snap-start flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm uppercase tracking-wider transition-all duration-200 ${
                                    isActive 
                                    ? `${theme.bg} text-pure-white ring-2 ${theme.ring} shadow-lg` 
                                    : 'bg-carbon-black/60 text-highlight-silver ring-1 ring-pure-white/10 hover:bg-pure-white/5'
                                }`}
                            >
                                <cat.icon className="w-4 h-4" />
                                <span>{cat.shortLabel}</span>
                                {leaderData && leaderData.score > 0 && (
                                    <span className="text-[10px] font-mono opacity-80">· {leaderData.score}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Dynamic Leaderboard Section */}
            <div key={activeCategory} className="md:flex-1 mb-8 pb-4 animate-fade-in">
                <div className="bg-carbon-fiber rounded-xl p-4 md:p-6 ring-1 ring-pure-white/10 shadow-xl border border-pure-white/5 relative overflow-hidden transition-all duration-300">
                    <div className="flex justify-between items-center mb-6 relative z-10 border-b border-pure-white/5 pb-4">
                        <div>
                            <h3 className="text-lg md:text-xl font-bold text-pure-white leading-tight uppercase italic tracking-wider">
                                {activeCategoryData?.listTitle}
                            </h3>
                            <p className={`text-xs font-bold uppercase tracking-widest mt-1 ${activeTheme.color} opacity-80`}>Performance Breakdown</p>
                        </div>
                    </div>

                    <div className="w-full relative z-10">
                        {top10List.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                                <div className="space-y-3">
                                    {top10List.slice(0, 5).map((user, idx) => {
                                        const rank = idx + 1;
                                        const score = user.breakdown?.[activeCategory] || 0;
                                        const maxScore = top10List[0].breakdown?.[activeCategory] || 1;
                                        const percent = (score / maxScore) * 100;
                                        return (
                                            <div key={user.id} className="group/row flex items-center gap-3 p-2.5 md:p-3 bg-carbon-black/40 rounded-lg hover:bg-pure-white/5 transition-colors border border-transparent hover:border-pure-white/10">
                                                <div className={`w-8 h-8 flex items-center justify-center font-black text-sm rounded-md ${rank <= 3 ? `${activeTheme.bg} text-carbon-black shadow-lg` : 'bg-pure-white/10 text-highlight-silver'}`}>
                                                    {rank}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className="font-bold text-pure-white truncate text-sm">{user.displayName}</span>
                                                        <span className={`font-mono font-bold ${activeTheme.color} text-sm`}>{score}</span>
                                                    </div>
                                                    <div className="w-full bg-carbon-black rounded-full h-1.5 overflow-hidden border border-pure-white/5">
                                                        <div className={`h-full rounded-full transition-all duration-500 ${activeTheme.bg} opacity-80`} style={{ width: `${percent}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="space-y-3">
                                    {top10List.slice(5, 10).map((user, idx) => {
                                        const rank = idx + 6;
                                        const score = user.breakdown?.[activeCategory] || 0;
                                        const maxScore = top10List[0].breakdown?.[activeCategory] || 1;
                                        const percent = (score / maxScore) * 100;
                                        return (
                                            <div key={user.id} className="group/row flex items-center gap-3 p-2.5 md:p-3 bg-carbon-black/40 rounded-lg hover:bg-pure-white/5 transition-colors border border-transparent hover:border-pure-white/10">
                                                <div className="w-8 h-8 flex items-center justify-center font-black text-sm rounded-md bg-pure-white/10 text-highlight-silver">
                                                    {rank}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-baseline mb-1">
                                                        <span className="font-bold text-pure-white truncate text-sm">{user.displayName}</span>
                                                        <span className={`font-mono font-bold ${activeTheme.color} text-sm`}>{score}</span>
                                                    </div>
                                                    <div className="w-full bg-carbon-black rounded-full h-1.5 overflow-hidden border border-pure-white/5">
                                                        <div className={`h-full rounded-full transition-all duration-500 ${activeTheme.bg} opacity-80`} style={{ width: `${percent}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="h-40 flex items-center justify-center text-highlight-silver italic text-sm py-8 opacity-50 bg-carbon-black/20 rounded-lg border border-dashed border-pure-white/10">
                                No points recorded in this category yet.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const P22View: React.FC<{ users: ProcessedUser[] }> = ({ users }) => {
    const p22Data = useMemo(() => {
        return [...users]
            .filter(u => u.breakdown?.p22 && u.breakdown.p22 > 0)
            .sort((a, b) => (b.breakdown!.p22 || 0) - (a.breakdown!.p22 || 0))
            .slice(0, 10);
    }, [users]);

    return (
        <div className="flex flex-col md:h-full animate-fade-in pb-24 md:pb-safe pt-2 md:overflow-y-auto custom-scrollbar pr-1">
            <div className="bg-carbon-fiber rounded-xl p-6 ring-1 ring-pure-white/10 shadow-lg border border-pure-white/5 mb-8">
                <div className="mb-6 border-b border-pure-white/10 pb-4 text-center">
                    <h2 className="text-2xl font-bold text-pure-white uppercase tracking-wider">The Wall of Shame</h2>
                    <p className="text-sm text-highlight-silver">Principals who picked the driver finishing P22 (Last Place) the most often.</p>
                </div>

                {p22Data.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {p22Data.map((user, idx) => (
                            <div key={user.id} className="flex items-center justify-between p-4 bg-carbon-black/40 rounded-lg border border-pure-white/5 hover:bg-pure-white/5 transition-colors">
                                <div className="flex items-center gap-4">
                                    <span className={`text-xl font-black w-8 text-center ${idx === 0 ? 'text-red-500' : 'text-highlight-silver'}`}>
                                        {idx + 1}
                                    </span>
                                    <div>
                                        <span className="font-bold text-pure-white text-lg block">{user.displayName || "Unknown"}</span>
                                        <span className="text-xs text-highlight-silver uppercase tracking-wider">Rank #{user.rank || '-'}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="block text-3xl font-black text-red-500/80 leading-none">{user.breakdown?.p22}</span>
                                    <span className="text-[10px] font-bold text-highlight-silver uppercase tracking-widest">Times</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center text-highlight-silver italic">
                        <TrashIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p>No one has picked the last-place driver yet. Good job!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const EntityStatsView: React.FC<{ raceResults: RaceResults; pointsSystem: PointsSystem; allDrivers: Driver[]; allConstructors: Constructor[]; events: Event[] }> = ({ raceResults, pointsSystem, allDrivers, allConstructors, events }) => {
    const stats = useMemo(() => {
        const driverScores: Record<string, { total: number; sprint: number; fl: number; quali: number }> = {};
        const teamScores: Record<string, number> = {};
        allDrivers.forEach(d => driverScores[d.id] = { total: 0, sprint: 0, fl: 0, quali: 0 });
        allConstructors.forEach(c => teamScores[c.id] = 0);

        // Strict Filtering: Iterate events schedule, not raw DB keys to avoid ghost data
        events.forEach(event => {
            const results = raceResults[event.id];
            if (!results) return;

            const addPoints = (driverId: string | null, pts: number, category: 'race' | 'sprint' | 'quali' | 'fl' = 'race') => {
                if (!driverId) return;
                if (driverScores[driverId]) {
                    driverScores[driverId].total += pts;
                    if (category === 'sprint') driverScores[driverId].sprint += pts;
                    if (category === 'quali') driverScores[driverId].quali += pts;
                }
                const driver = allDrivers.find(d => d.id === driverId);
                const teamId = results.driverTeams?.[driverId] || driver?.constructorId;
                if (teamId && teamScores[teamId] !== undefined) teamScores[teamId] += pts;
            };
            if (results.grandPrixFinish) results.grandPrixFinish.forEach((did, idx) => addPoints(did, pointsSystem.grandPrixFinish[idx] || 0, 'race'));
            if (results.sprintFinish) results.sprintFinish.forEach((did, idx) => addPoints(did, pointsSystem.sprintFinish[idx] || 0, 'sprint'));
            if (results.gpQualifying) results.gpQualifying.forEach((did, idx) => addPoints(did, pointsSystem.gpQualifying[idx] || 0, 'quali'));
            if (results.sprintQualifying) results.sprintQualifying.forEach((did, idx) => addPoints(did, pointsSystem.sprintQualifying[idx] || 0, 'quali'));
            if (results.fastestLap) {
                addPoints(results.fastestLap, pointsSystem.fastestLap, 'fl');
                if (driverScores[results.fastestLap]) driverScores[results.fastestLap].fl += 1;
            }
        });

        const getColor = (id: string, type: 'team' | 'driver') => {
            if (type === 'team') {
                const team = allConstructors.find(c => c.id === id);
                return team?.color || CONSTRUCTORS.find(c => c.id === id)?.color;
            } else {
                const driver = allDrivers.find(d => d.id === id);
                if (!driver) return undefined;
                const team = allConstructors.find(c => c.id === driver.constructorId);
                return team?.color || CONSTRUCTORS.find(c => c.id === driver.constructorId)?.color;
            }
        };

        const formatData = (source: Record<string, any>, valueFn: (k: string) => number, nameFn: (id: string) => string, type: 'team' | 'driver', limitCount?: number, keepZeros: boolean = false) => {
            return Object.keys(source)
                .map(id => ({ label: nameFn(id), value: valueFn(id), color: getColor(id, type) }))
                .sort((a, b) => b.value !== a.value ? b.value - a.value : a.label.localeCompare(b.label))
                .filter(item => keepZeros || item.value > 0)
                .slice(0, limitCount);
        };
        const getName = (id: string) => getEntityName(id, allDrivers, allConstructors);
        return { 
            teamsTotal: formatData(teamScores, (id) => teamScores[id], getName, 'team', undefined, true), 
            driversTotal: formatData(driverScores, (id) => driverScores[id].total, getName, 'driver', 10), 
            driversSprint: formatData(driverScores, (id) => driverScores[id].sprint, getName, 'driver', 5), 
            driversQuali: formatData(driverScores, (id) => driverScores[id].quali, getName, 'driver', 5), 
            driversFL: formatData(driverScores, (id) => driverScores[id].fl, getName, 'driver', 5) 
        };
    }, [raceResults, pointsSystem, allDrivers, allConstructors, events]);

    return (
        <div className="space-y-8 animate-fade-in pt-4 pb-24 md:pb-12 md:h-full md:overflow-y-auto custom-scrollbar px-1">
            <div className="bg-carbon-fiber shadow-lg rounded-xl p-6 border border-pure-white/10">
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-pure-white uppercase tracking-wider flex items-center gap-3">
                        <TeamIcon className="w-6 h-6 text-primary-red"/> Constructor Standings
                    </h3>
                    <p className="text-xs text-highlight-silver italic mt-1 ml-9">* Points earned by both drivers per constructor</p>
                </div>
                <ConstructorPodium data={stats.teamsTotal} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-carbon-fiber rounded-xl p-6 border border-pure-white/10 shadow-lg">
                    <h3 className="text-sm font-bold text-highlight-silver uppercase tracking-widest mb-6 flex items-center gap-2">
                        <DriverIcon className="w-5 h-5 text-primary-red" /> Driver Top 10 (Overall)
                    </h3>
                    <SimpleBarChart data={stats.driversTotal} />
                </div>
                <div className="bg-carbon-fiber rounded-xl p-6 border border-pure-white/10 shadow-lg">
                    <h3 className="text-sm font-bold text-highlight-silver uppercase tracking-widest mb-6 flex items-center gap-2">
                        <PolePositionIcon className="w-5 h-5 text-blue-500" /> Qualifying Points
                    </h3>
                    <p className="text-[10px] text-highlight-silver/70 -mt-4 mb-4 ml-7">Includes GP Quali & Sprint Quali Scores</p>
                    <SimpleBarChart data={stats.driversQuali} />
                </div>
                <div className="bg-carbon-fiber rounded-xl p-6 border border-pure-white/10 shadow-lg">
                    <h3 className="text-sm font-bold text-highlight-silver uppercase tracking-widest mb-6 flex items-center gap-2">
                        <SprintIcon className="w-5 h-5 text-yellow-500" /> Sprint Specialists
                    </h3>
                    <SimpleBarChart data={stats.driversSprint} />
                </div>
                <div className="bg-carbon-fiber rounded-xl p-6 border border-pure-white/10 shadow-lg">
                    <h3 className="text-sm font-bold text-highlight-silver uppercase tracking-widest mb-6 flex items-center gap-2">
                        <FastestLapIcon className="w-5 h-5 text-purple-500" /> Fastest Lap Counts
                    </h3>
                    <SimpleBarChart data={stats.driversFL} />
                </div>
            </div>
        </div>
    );
};

// --- Main Page ---

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ currentUser, raceResults, pointsSystem, allDrivers, allConstructors, events, leaderboardCache, refreshLeaderboard, resetToken }) => {
  const [view, setView] = useState<ViewState>('menu');
  const [processedUsers, setProcessedUsers] = useState<ProcessedUser[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaging, setIsPaging] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // New: Global league picks for popularity calculation
  const [allLeaguePicks, setAllLeaguePicks] = useState<{ [uid: string]: { [eid: string]: PickSelection } }>({});
  const [isFetchingGlobalPicks, setIsFetchingGlobalPicks] = useState(false);

  // New: Modal User State
  const [selectedUserProfile, setSelectedUserProfile] = useState<ProcessedUser | null>(null);
  const [modalPicks, setModalPicks] = useState<any>(null);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  
  const pageRef = useRef<HTMLDivElement>(null);

  // Initialize from storage or default
  const [refreshPolicy, setRefreshPolicy] = useState<RefreshPolicy>(() => {
        const saved = localStorage.getItem('lb_refresh_policy');
        return saved ? JSON.parse(saved) : { count: 0, lastRefresh: 0, dayStart: Date.now(), lockedUntil: 0 };
  });

    // Fix: When the view changes, find the main scrolling container and scroll it to the top.
    useEffect(() => {
        if (view !== 'menu' && pageRef.current) {
            let scrollParent = pageRef.current.parentElement;
            while (scrollParent) {
                const { overflowY } = window.getComputedStyle(scrollParent);
                if (overflowY === 'auto' || overflowY === 'scroll') {
                    scrollParent.scrollTop = 0;
                    return;
                }
                scrollParent = scrollParent.parentElement;
            }
            // Fallback for body/window scrolling
            window.scrollTo(0, 0);
        }
    }, [view]);

  // Calculate initial cooldown/lockout time
  const calculateRemainingTime = useCallback(() => {
        const now = Date.now();
        if (refreshPolicy.lockedUntil > now) {
            return Math.ceil((refreshPolicy.lockedUntil - now) / 1000);
        }
        const elapsed = (now - refreshPolicy.lastRefresh) / 1000;
        if (elapsed < REFRESH_COOLDOWN_SECONDS) {
            return Math.ceil(REFRESH_COOLDOWN_SECONDS - elapsed);
        }
        return 0;
  }, [refreshPolicy]);

  const [cooldownTime, setCooldownTime] = useState(calculateRemainingTime());

  // Check for daily reset on mount/focus to ensure UI is up to date
  useEffect(() => {
      const checkPolicyIntegrity = () => {
          const now = Date.now();
          const stored = localStorage.getItem('lb_refresh_policy');
          if (stored) {
              const p = JSON.parse(stored);
              
              // Condition 1: Day has passed (24h window)
              if (now - p.dayStart > 24 * 60 * 60 * 1000) {
                  const newP = { count: 0, lastRefresh: 0, dayStart: now, lockedUntil: 0 };
                  localStorage.setItem('lb_refresh_policy', JSON.stringify(newP));
                  setRefreshPolicy(newP);
                  setCooldownTime(0);
                  return;
              }

              // Condition 2: Lockout has expired but day hasn't reset (Edge case correction)
              if (p.lockedUntil > 0 && now > p.lockedUntil) {
                   const newP = { ...p, lockedUntil: 0 };
                   localStorage.setItem('lb_refresh_policy', JSON.stringify(newP));
                   setRefreshPolicy(newP);
                   setCooldownTime(0);
              }
          }
      };

      checkPolicyIntegrity();
      window.addEventListener('focus', checkPolicyIntegrity);
      return () => window.removeEventListener('focus', checkPolicyIntegrity);
  }, []);

  // Fetch Picks on Modal Open if needed
  useEffect(() => {
    if (selectedUserProfile) {
        // Check cache first
        const cached = leaderboardCache?.allPicks?.[selectedUserProfile.id];
        // Ensure cached is not just an empty object if user actually has picks (but cache might be partial)
        // For simplicity, if cache exists and source is 'private_fallback', we trust it. 
        // If source is 'public', allPicks is usually empty, so we must fetch.
        
        // However, fetching a single user doc is cheap.
        if (cached && Object.keys(cached).length > 0) {
            setModalPicks(cached);
        } else {
            setIsLoadingPicks(true);
            getUserPicks(selectedUserProfile.id).then(picks => {
                setModalPicks(picks);
                setIsLoadingPicks(false);
            }).catch(err => {
                console.error("Failed to fetch user picks", err);
                setIsLoadingPicks(false);
            });
        }
    } else {
        setModalPicks(null);
    }
  }, [selectedUserProfile, leaderboardCache]);

  // [S1A-03] Extract scoring transformations out of React Effects
  const loadProcessedData = useCallback(async (usersBatch: User[], picksBatch: any, isMore = false) => {
      // Logic extracted to service module processLeaderboardStats
      const processedBatch = await processLeaderboardStats(usersBatch, picksBatch, raceResults, pointsSystem, allDrivers, currentUser);
      if (isMore) {
          setProcessedUsers(prev => [...prev, ...processedBatch]);
      } else {
          setProcessedUsers(processedBatch);
      }
  }, [raceResults, pointsSystem, allDrivers, currentUser]);

  // Timer Effect
  useEffect(() => {
      if (cooldownTime <= 0) return;
      const timer = setInterval(() => {
          setCooldownTime(prev => {
              if (prev <= 1) {
                  // Timer finished. 
                  const stored = localStorage.getItem('lb_refresh_policy');
                  if (stored) {
                      const p = JSON.parse(stored);
                      if (p.lockedUntil > 0 && Date.now() > p.lockedUntil) {
                          const resetP = { ...p, lockedUntil: 0, count: 0, dayStart: Date.now() };
                          localStorage.setItem('lb_refresh_policy', JSON.stringify(resetP));
                          setRefreshPolicy(resetP);
                      }
                  }
                  return 0;
              }
              return prev - 1;
          });
      }, 1000);
      return () => clearInterval(timer);
  }, [cooldownTime]);

  // Reset view to menu when resetToken changes
  useEffect(() => {
    if (resetToken !== undefined) {
      setView('menu');
    }
  }, [resetToken]);

  // Initial Data Load
  useEffect(() => {
      if (!leaderboardCache) {
          refreshLeaderboard();
      } else {
          loadProcessedData(leaderboardCache.users, leaderboardCache.allPicks);
          setHasMore(leaderboardCache.users.length === DEFAULT_PAGE_SIZE);
      }
  }, [leaderboardCache]); // Only re-run when cache itself changes

  // Global Picks Fetch Effect for Popularity View
  useEffect(() => {
    if (view === 'popular' && Object.keys(allLeaguePicks).length === 0 && !isFetchingGlobalPicks) {
        setIsFetchingGlobalPicks(true);
        fetchAllUserPicks()
            .then(picks => {
                setAllLeaguePicks(picks);
                setIsFetchingGlobalPicks(false);
            })
            .catch(err => {
                console.error("Failed to fetch global league picks:", err);
                setIsFetchingGlobalPicks(false);
            });
    }
  }, [view, allLeaguePicks, isFetchingGlobalPicks]);

  // [S1A-03] Handle external system updates (scoring rules/results changes)
  // We process with a slight delay to ensure UI stays responsive during rapid changes
  useEffect(() => {
    if (leaderboardCache) {
        const timeout = setTimeout(() => {
            loadProcessedData(leaderboardCache.users, leaderboardCache.allPicks);
        }, 300);
        return () => clearTimeout(timeout);
    }
  }, [raceResults, pointsSystem, allDrivers, currentUser, loadProcessedData]);

  const handleFetchMore = async () => {
    if (isPaging || !hasMore) return;
    setIsPaging(true);
    try {
        const { users, allPicks, lastDoc } = await getAllUsersAndPicks(DEFAULT_PAGE_SIZE, lastVisible || (leaderboardCache as any)?.lastDoc);
        await loadProcessedData(users, allPicks, true);
        setLastVisible(lastDoc);
        setHasMore(users.length === DEFAULT_PAGE_SIZE);
    } catch (e) {
        console.error(e);
    } finally {
        setIsPaging(false);
    }
  };

  const handleManualRefresh = async () => {
      // 1. Check Cooldown & Lock Status
      if (cooldownTime > 0 || isRefreshing) return;

      const now = Date.now();
      
      // 2. Check Daily Reset Logic
      let currentPolicy = { ...refreshPolicy };
      // If last reset was more than 24h ago, reset count
      if (now - currentPolicy.dayStart > 24 * 60 * 60 * 1000) {
          currentPolicy = { count: 0, lastRefresh: 0, dayStart: now, lockedUntil: 0 };
      }

      // 3. Check Daily Limit
      if (currentPolicy.count >= MAX_DAILY_REFRESHES) {
          // Lock User Out
          const lockedUntil = now + LOCKOUT_DURATION_MS;
          const newPolicy = { ...currentPolicy, lockedUntil };
          setRefreshPolicy(newPolicy);
          localStorage.setItem('lb_refresh_policy', JSON.stringify(newPolicy));
          setCooldownTime(Math.ceil(LOCKOUT_DURATION_MS / 1000));
          return;
      }

      setIsRefreshing(true);
      setRefreshStatus('idle');
      try {
          await refreshLeaderboard();
          // If on popular view, also refresh global picks
          if (view === 'popular') {
              setIsFetchingGlobalPicks(true);
              const picks = await fetchAllUserPicks();
              setAllLeaguePicks(picks);
              setIsFetchingGlobalPicks(false);
          }
          setRefreshStatus('success');
          
          // 4. Update Policy on Success
          const newCount = currentPolicy.count + 1;
          let newLockedUntil = 0;
          let newCooldown = REFRESH_COOLDOWN_SECONDS;

          // If this hit the limit, lock them out immediately for next time
          if (newCount >= MAX_DAILY_REFRESHES) {
              newLockedUntil = now + LOCKOUT_DURATION_MS;
              newCooldown = Math.ceil(LOCKOUT_DURATION_MS / 1000);
          }

          const newPolicy = {
              ...currentPolicy,
              count: newCount,
              lastRefresh: now,
              lockedUntil: newLockedUntil
          };
          
          setRefreshPolicy(newPolicy);
          localStorage.setItem('lb_refresh_policy', JSON.stringify(newPolicy));
          setCooldownTime(newCooldown);

          setLastVisible(null);
          setTimeout(() => setRefreshStatus('idle'), 3000);
      } catch (e) {
          console.error(e);
          setRefreshStatus('error');
          setTimeout(() => setRefreshStatus('idle'), 3000);
      } finally {
          setIsRefreshing(false);
      }
  };

  const isLoading = !leaderboardCache && processedUsers.length === 0;

  if (isLoading) return <ListSkeleton rows={10} />;

  if (view === 'menu') {
      return (
          <div className="w-full max-w-7xl mx-auto animate-fade-in">
              <PageHeader 
                title="LEADERBOARDS" 
                icon={LeaderboardIcon} 
                rightAction={<RefreshControl onClick={handleManualRefresh} isRefreshing={isRefreshing} cooldown={cooldownTime} status={refreshStatus} dailyCount={refreshPolicy.count}/>}
              />
              <div className="pb-20 md:pb-12 px-4 md:px-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      <NavTile icon={LeaderboardIcon} title="Standings" subtitle="League Table" desc="View the full league table sorted by total points." onClick={() => setView('standings')} />
                      <NavTile icon={TrendingUpIcon} title="Popular Picks" subtitle="Trends" desc="See which drivers and teams are trending this season." onClick={() => setView('popular')} delay="100ms" />
                      <NavTile icon={TeamIcon} title="Teams & Driver Results" subtitle="Breakdown" desc="Real-world performance breakdown with our league scoring system." onClick={() => setView('entities')} delay="200ms" />
                      <NavTile icon={LightbulbIcon} title="Insights" subtitle="Deep Dive" desc="Deep dive into performance breakdowns and superlatives." onClick={() => setView('insights')} delay="300ms" />
                      <NavTile icon={TrashIcon} title="P22 Tracker" subtitle="The Wall of Shame" desc="Principals who picked the driver finishing P22 (Last Place) the most often." onClick={() => setView('p22')} delay="400ms" />
                  </div>
              </div>
          </div>
      );
  }

  // Merge current user data if self-inspecting to show PII
  const userToDisplay = (currentUser && selectedUserProfile && currentUser.id === selectedUserProfile.id) 
    ? { ...selectedUserProfile, ...currentUser } 
    : selectedUserProfile;

  return (
      <div ref={pageRef} className="flex flex-col md:h-full md:overflow-hidden w-full max-w-7xl mx-auto">
          <div className="flex-none pb-4 md:pb-6">
              <div className="flex flex-col items-center md:flex-row justify-between px-2 md:px-0 gap-4">
                  <div className="hidden md:flex items-center justify-between w-full md:w-auto">
                      <button onClick={() => setView('menu')} className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors font-bold py-2 group">
                          <BackIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back to Hub
                      </button>
                  </div>
                  
                  <div className="flex items-center justify-center md:absolute md:left-1/2 md:transform md:-translate-x-1/2 gap-2 md:gap-3">
                        <div className="p-1.5 md:p-2 bg-primary-red/10 rounded-full border border-primary-red/20 shadow-[0_0_15px_rgba(218,41,28,0.2)] flex">
                            {view === 'standings' && <LeaderboardIcon className="w-4 h-4 md:w-6 md:h-6 text-primary-red" />}
                            {view === 'entities' && <TeamIcon className="w-4 h-4 md:w-6 md:h-6 text-primary-red" />}
                            {view === 'popular' && <TrendingUpIcon className="w-4 h-4 md:w-6 md:h-6 text-primary-red" />}
                            {view === 'insights' && <LightbulbIcon className="w-4 h-4 md:w-6 md:h-6 text-primary-red" />}
                            {view === 'p22' && <TrashIcon className="w-4 h-4 md:w-6 md:h-6 text-primary-red" />}
                        </div>
                        <h1 className="text-base md:text-2xl font-bold text-pure-white uppercase italic tracking-wider whitespace-nowrap text-center">
                            {view === 'standings' ? 'League Standings' : view === 'entities' ? 'Driver & Team Points' : view === 'popular' ? 'Popular Picks Analysis' : view === 'p22' ? 'P22 Tracker' : 'Performance Insights'}
                        </h1>
                  </div>
                  
                  <RefreshControl onClick={handleManualRefresh} isRefreshing={isRefreshing} cooldown={cooldownTime} status={refreshStatus} dailyCount={refreshPolicy.count} />
              </div>
          </div>

          <div className="md:flex-1 md:overflow-hidden px-2 md:px-0 pb-4">
            {view === 'standings' && <StandingsView users={processedUsers} currentUser={currentUser} hasMore={hasMore} onFetchMore={handleFetchMore} isPaging={isPaging} onSelectUser={setSelectedUserProfile} />}
            {view === 'popular' && <PopularityView allLeaguePicks={allLeaguePicks} allDrivers={allDrivers} allConstructors={allConstructors} events={events} isLoading={isFetchingGlobalPicks} />}
            {view === 'insights' && leaderboardCache && <InsightsView users={processedUsers} allPicks={leaderboardCache.allPicks} raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} events={events} />}
            {view === 'entities' && <EntityStatsView raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} events={events} />}
            {view === 'p22' && <P22View users={processedUsers} />}
          </div>

          {/* User Profile Modal */}
          {selectedUserProfile && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedUserProfile(null)}>
                <div className="bg-carbon-black border border-pure-white/10 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
                    {/* Header - Centered with Red Icon */}
                    <div className="relative flex items-center justify-center p-4 border-b border-pure-white/10 bg-carbon-fiber">
                        <div className="flex items-center gap-3">
                            <div className="bg-primary-red/20 p-2 rounded-full border border-primary-red/50 shadow-[0_0_10px_rgba(218,41,28,0.3)]">
                                <F1CarIcon className="w-5 h-5 text-primary-red" />
                            </div>
                            <h2 className="text-xl md:text-2xl font-black text-pure-white uppercase italic tracking-wider">
                                Team Inspection
                            </h2>
                        </div>
                        <button 
                            onClick={() => setSelectedUserProfile(null)} 
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-pure-white/10 rounded-full text-highlight-silver hover:text-pure-white transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 bg-carbon-black/50">
                        {isLoadingPicks ? (
                            <ProfileSkeleton />
                        ) : (
                            <ProfilePage 
                                user={userToDisplay!}
                                seasonPicks={modalPicks || {}}
                                raceResults={raceResults}
                                pointsSystem={pointsSystem}
                                allDrivers={allDrivers}
                                allConstructors={allConstructors}
                                events={events}
                                isPublicView={true}
                            />
                        )}
                    </div>
                </div>
            </div>
          )}
      </div>
  );
};

export default LeaderboardPage;
