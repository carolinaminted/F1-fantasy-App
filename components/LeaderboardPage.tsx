import React, { useMemo, useState, useEffect } from 'react';
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
/* Fix: Import DriverIcon to resolve name collision/missing name error */
import { DriverIcon } from './icons/DriverIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { ListSkeleton } from './LoadingSkeleton.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import { PageHeader } from './ui/PageHeader.tsx';
import { DEFAULT_PAGE_SIZE, getAllUsersAndPicks } from '../services/firestoreService.ts';

// --- Shared Types & Helpers ---

type ViewState = 'menu' | 'standings' | 'popular' | 'insights' | 'entities';

type ProcessedUser = User;

interface LeaderboardPageProps {
  currentUser: User | null;
  raceResults: RaceResults;
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  events: Event[];
  leaderboardCache: LeaderboardCache | null;
  refreshLeaderboard: () => Promise<void>;
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
}> = ({ onClick, isRefreshing, cooldown, status }) => {
    
    return (
        <div className="relative flex items-center">
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
                    flex items-center justify-center gap-2 p-2 rounded-lg transition-all duration-200 border
                    ${(isRefreshing || cooldown > 0)
                        ? 'bg-carbon-black border-accent-gray text-highlight-silver/50 cursor-not-allowed'
                        : 'bg-carbon-black border-accent-gray text-highlight-silver hover:text-pure-white hover:border-primary-red hover:shadow-[0_0_10px_rgba(218,41,28,0.2)]'
                    }
                `}
                title={cooldown > 0 ? `Wait ${cooldown}s` : "Refresh Data"}
            >
                {cooldown > 0 ? (
                    <span className="text-xs font-mono font-bold w-12 text-center">
                        {cooldown}s
                    </span>
                ) : (
                    <div className="flex items-center gap-2 px-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${isRefreshing ? 'animate-spin text-primary-red' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span className="text-sm font-bold uppercase hidden md:inline">Refresh</span>
                    </div>
                )}
            </button>
        </div>
    );
};

const NavTile: React.FC<{ icon: any; title: string; subtitle: string; desc: string; onClick: () => void; delay?: string }> = ({ icon: Icon, title, subtitle, desc, onClick, delay = '0ms' }) => (
    <button
        onClick={onClick}
        className="group relative overflow-hidden rounded-xl p-5 text-left border border-pure-white/10 hover:border-primary-red/50 shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 flex flex-col h-full w-full bg-carbon-fiber animate-fade-in-up"
        style={{ animationDelay: delay }}
    >
        <div className="absolute -bottom-6 -right-6 p-0 opacity-[0.03] transition-all transform duration-500 pointer-events-none group-hover:scale-110 group-hover:rotate-12 group-hover:opacity-10 text-pure-white">
            <Icon className="w-48 h-48" />
        </div>
        
        <div className="flex items-start justify-between mb-3 relative z-10">
             <div className="w-10 h-10 rounded-lg flex items-center justify-center transition-colors shadow-lg border bg-carbon-black/50 text-primary-red border-pure-white/5 group-hover:bg-primary-red/20">
                <Icon className="w-5 h-5" />
            </div>
            <p className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider bg-carbon-black/30 px-2 py-1 rounded border border-pure-white/5">{subtitle}</p>
        </div>
        
        <div className="relative z-10 flex-grow flex flex-col justify-center">
            <h3 className="text-2xl font-bold mb-2 transition-colors leading-none text-pure-white group-hover:text-primary-red">{title}</h3>
            <p className="text-highlight-silver/70 text-sm leading-snug">{desc}</p>
        </div>
        
        <div className="mt-3 pt-3 border-t border-pure-white/5 flex items-center justify-between text-xs font-bold text-pure-white opacity-60 group-hover:opacity-100 transition-opacity relative z-10">
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
                        <span className="w-24 md:w-32 text-right truncate font-semibold text-highlight-silver text-xs md:text-sm">{item.label}</span>
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

const RaceChart: React.FC<{ users: ProcessedUser[], hasMore: boolean, onFetchMore: () => void, isPaging: boolean }> = ({ users, hasMore, onFetchMore, isPaging }) => {
    const maxPoints = Math.max(...users.map(u => u.totalPoints || 0), 1);

    if (users.length === 0) return null;
    
    return (
        <div className="w-full py-2 px-1 md:px-2 md:py-4">
            <div className="relative">
                <div className="absolute top-0 bottom-0 right-10 md:right-14 w-px border-r-2 border-dashed border-pure-white/10 z-0"></div>

                <div className="space-y-1 relative z-10 pb-8">
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

                        return (
                            <div key={user.id} className="flex items-center gap-2 md:gap-3 h-10 md:h-12 group hover:bg-pure-white/5 rounded-lg px-1 md:px-2 transition-colors">
                                <div className={`w-6 md:w-8 text-center font-black text-sm md:text-lg ${rankColor} shrink-0`}>
                                    {rank}
                                </div>
                                <div className="w-24 md:w-60 text-right truncate font-semibold md:font-bold text-[10px] md:text-sm text-highlight-silver group-hover:text-pure-white transition-colors shrink-0">
                                    {user.displayName}
                                </div>
                                <div className="flex-1 relative h-full flex items-center ml-2 md:ml-8 mr-1 md:mr-2">
                                    <div className="absolute left-0 right-0 h-px bg-pure-white/10 w-full rounded-full"></div>
                                    <div 
                                        className="relative h-full flex items-center justify-end transition-all duration-1000 ease-out pr-6 md:pr-14"
                                        style={{ width: `${percent}%` }}
                                    >
                                        <div className="relative">
                                            <F1CarIcon className={`w-6 h-6 md:w-8 md:h-8 transform -rotate-90 ${carColor} transition-transform group-hover:scale-110`} />
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
}> = ({ users, currentUser, hasMore, onFetchMore, isPaging }) => {
    const raceLeader = Math.max(...users.map(u => u.totalPoints || 0), 0);

    return (
        <div className="flex flex-col h-full animate-fade-in pb-safe overflow-hidden">
            <div className="flex flex-col h-full bg-carbon-fiber border border-pure-white/10 rounded-xl overflow-hidden shadow-2xl">
                <div className="flex-none bg-carbon-black/60 text-pure-white border-b border-pure-white/10 p-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <LeaderboardIcon className="w-6 h-6 text-primary-red" />
                        <span className="font-bold text-lg uppercase tracking-wider italic">League Standings</span>
                    </div>
                    <div className="text-xs font-bold text-highlight-silver hidden sm:flex items-center gap-2">
                        Race Leader: {raceLeader} PTS <CheckeredFlagIcon className="w-4 h-4 text-pure-white"/>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 min-h-0">
                    <RaceChart users={users} hasMore={hasMore} onFetchMore={onFetchMore} isPaging={isPaging} />
                </div>
            </div>
        </div>
    );
};

const PopularityView: React.FC<{ allPicks: { [uid: string]: { [eid: string]: PickSelection } }; allDrivers: Driver[]; allConstructors: Constructor[]; events: Event[] }> = ({ allPicks, allDrivers, allConstructors, events }) => {
    const [timeRange, setTimeRange] = useState<'all' | '30' | '60' | '90'>('all');

    const stats = useMemo(() => {
        const teamCounts: { [id: string]: number } = {};
        allConstructors.forEach(c => teamCounts[c.id] = 0);
        const driverCounts: { [id: string]: number } = {};
        allDrivers.forEach(d => driverCounts[d.id] = 0);

        let relevantEvents: Event[] = events;
        if (timeRange === '30') relevantEvents = events.slice(0, 3); 
        if (timeRange === '60') relevantEvents = events.slice(0, 5);
        if (timeRange === '90') relevantEvents = events.slice(0, 8);
        
        const relevantEventIds = new Set(relevantEvents.map(e => e.id));

        Object.values(allPicks).forEach(userPicks => {
            Object.entries(userPicks).forEach(([eventId, picks]) => {
                if (!relevantEventIds.has(eventId)) return;
                const teams = [...picks.aTeams, picks.bTeam].filter(Boolean) as string[];
                const drivers = [...picks.aDrivers, picks.bDrivers].filter(Boolean) as string[];
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
                .sort((a, b) => order === 'desc' ? b.value - a.value : a.value - b.value)
                .slice(0, 5);

        return {
            teams: sortAndMap(teamCounts, 'desc', 'team'),
            leastTeams: sortAndMap(teamCounts, 'asc', 'team'),
            drivers: sortAndMap(driverCounts, 'desc', 'driver'),
            leastDrivers: sortAndMap(driverCounts, 'asc', 'driver')
        };
    }, [allPicks, timeRange, allDrivers, allConstructors, events]);

    return (
        <div className="flex flex-col h-full animate-fade-in gap-4 pt-2 pb-4 overflow-hidden">
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
                            {range === 'all' ? 'Season' : `${range} Days`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 grid grid-rows-2 gap-4 min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-carbon-fiber rounded-lg p-4 ring-1 ring-pure-white/10 shadow-lg flex flex-col">
                        <h3 className="text-sm font-bold text-highlight-silver mb-3 uppercase tracking-wider flex-none">Most Picked Teams</h3>
                        <div className="flex-1 overflow-hidden">
                             <SimpleBarChart data={stats.teams} />
                        </div>
                    </div>
                    <div className="bg-carbon-fiber rounded-lg p-4 ring-1 ring-pure-white/10 shadow-lg flex flex-col">
                        <h3 className="text-sm font-bold text-highlight-silver mb-3 uppercase tracking-wider flex-none">Most Picked Drivers</h3>
                        <div className="flex-1 overflow-hidden">
                             <SimpleBarChart data={stats.drivers} />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-carbon-fiber rounded-lg p-4 ring-1 ring-pure-white/10 shadow-lg flex flex-col">
                        <h3 className="text-sm font-bold text-highlight-silver mb-3 uppercase tracking-wider flex-none">Least Picked Teams</h3>
                        <div className="flex-1 overflow-hidden">
                            <SimpleBarChart data={stats.leastTeams} max={Math.max(...stats.teams.map(t => t.value), 1)} />
                        </div>
                    </div>
                    <div className="bg-carbon-fiber rounded-lg p-4 ring-1 ring-pure-white/10 shadow-lg flex flex-col">
                        <h3 className="text-sm font-bold text-highlight-silver mb-3 uppercase tracking-wider flex-none">Least Picked Drivers</h3>
                        <div className="flex-1 overflow-hidden">
                            <SimpleBarChart data={stats.leastDrivers} max={Math.max(...stats.drivers.map(d => d.value), 1)} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
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
    const superlatives = useMemo(() => {
        if (users.length === 0) return null;
        const findMax = (key: keyof NonNullable<ProcessedUser['breakdown']>) => {
            const validUsers = users.filter(u => u.breakdown && typeof u.breakdown[key] === 'number');
            if (validUsers.length === 0) return null;
            const sorted = [...validUsers].sort((a, b) => (b.breakdown?.[key] || 0) - (a.breakdown?.[key] || 0));
            if ((sorted[0].breakdown?.[key] || 0) <= 0) return null;
            return { user: sorted[0], score: sorted[0].breakdown![key] };
        };
        return { gp: findMax('gp'), quali: findMax('quali'), sprint: findMax('sprint'), fl: findMax('fl') };
    }, [users]);

    const chartData = useMemo(() => {
        const sortedBy = (key: keyof NonNullable<ProcessedUser['breakdown']>) => 
            [...users]
                .filter(u => u.breakdown)
                .sort((a, b) => (b.breakdown![key] || 0) - (a.breakdown![key] || 0))
                .slice(0, 5)
                .map(u => ({ label: u.displayName, value: u.breakdown![key] || 0 }));

        return {
            total: [...users].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)).slice(0, 5).map(u => ({ label: u.displayName, value: u.totalPoints || 0 })),
            gp: sortedBy('gp'),
            quali: sortedBy('quali'),
            sprint: sortedBy('sprint'),
            fl: sortedBy('fl')
        };
    }, [users]);

    const TrendChart: React.FC<{ title: string; data: { label: string; value: number }[]; subtitle: string; icon?: any }> = ({ title, data, subtitle, icon: Icon }) => (
        <div className="bg-carbon-fiber rounded-lg p-6 ring-1 ring-pure-white/10 flex flex-col h-full shadow-lg overflow-hidden border border-pure-white/5">
            <div className="flex justify-between items-start mb-4 border-b border-pure-white/10 pb-2 flex-none">
                <div>
                    <h3 className="text-lg font-bold text-pure-white">{title}</h3>
                    <p className="text-xs text-highlight-silver uppercase tracking-wider">{subtitle}</p>
                </div>
                {Icon && <Icon className="w-5 h-5 text-primary-red" />}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {data.length > 0 ? (
                    <div className="space-y-3">
                        {data.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                                <span className={`w-5 text-center font-bold text-sm ${idx === 0 ? 'text-yellow-400' : 'text-highlight-silver'}`}>{idx + 1}</span>
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="font-semibold text-ghost-white truncate">{item.label}</span>
                                        <span className="font-mono font-bold text-lg md:text-xl text-primary-red">{item.value}</span>
                                    </div>
                                    <div className="w-full bg-carbon-black rounded-full h-1.5 border border-pure-white/5">
                                        <div 
                                            className={`h-1.5 rounded-full ${idx === 0 ? 'bg-yellow-400' : 'bg-highlight-silver/50'}`} 
                                            style={{ width: `${(item.value / Math.max(data[0].value, 1)) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-highlight-silver italic text-sm py-8">
                        Not enough data.
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full gap-6 animate-fade-in pb-safe pt-2 overflow-y-auto custom-scrollbar pr-1">
            {/* Top Superlatives */}
            <div className="flex-none grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SuperlativeCard title="Race Day Dominator" icon={CheckeredFlagIcon} data={superlatives?.gp || null} />
                <SuperlativeCard title="Qualifying King" icon={PolePositionIcon} data={superlatives?.quali || null} />
                <SuperlativeCard title="Sprint Specialist" icon={SprintIcon} data={superlatives?.sprint || null} />
                <SuperlativeCard title="Fastest Lap Hunter" icon={FastestLapIcon} data={superlatives?.fl || null} />
            </div>

            {/* Detailed Analytics Grid */}
            <div className="flex-none grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 pb-4">
                <TrendChart title="Overall Power Ranking" subtitle="Top 5 Total Points" data={chartData.total} icon={TrophyIcon} />
                <TrendChart title="Qualifying Masters" subtitle="Top 5 Quali Points" data={chartData.quali} icon={PolePositionIcon} />
                <TrendChart title="Sunday Specialists" subtitle="Top 5 Grand Prix Points" data={chartData.gp} icon={CheckeredFlagIcon} />
                <TrendChart title="Sprint Specialists" subtitle="Top 5 Sprint Points" data={chartData.sprint} icon={SprintIcon} />
            </div>
        </div>
    );
};

const SuperlativeCard: React.FC<{ title: string; icon: any; data: { user: ProcessedUser; score: number } | null }> = ({ title, icon: Icon, data }) => (
    <div className="bg-carbon-fiber rounded-lg p-4 ring-1 ring-pure-white/10 flex items-center gap-4 shadow-lg h-full border border-pure-white/5">
       <div className="bg-carbon-black p-3 rounded-full text-primary-red border border-pure-white/5 flex-shrink-0 shadow-inner">
           <Icon className="w-8 h-8" />
       </div>
       <div className="min-w-0">
           <p className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider truncate mb-0.5">{title}</p>
           {data ? (
               <>
                   <p className="text-xl font-bold text-pure-white truncate">{data.user.displayName}</p>
                   <p className="text-3xl md:text-4xl font-black text-primary-red font-mono mt-1 leading-none drop-shadow-md">
                       {Number(data.score || 0).toLocaleString()} <span className="text-[10px] font-bold text-highlight-silver align-top uppercase">pts</span>
                   </p>
               </>
           ) : (
               <p className="text-sm text-highlight-silver italic mt-1">No data yet</p>
           )}
       </div>
   </div>
);

const EntityStatsView: React.FC<{ raceResults: RaceResults; pointsSystem: PointsSystem; allDrivers: Driver[]; allConstructors: Constructor[] }> = ({ raceResults, pointsSystem, allDrivers, allConstructors }) => {
    const stats = useMemo(() => {
        const driverScores: Record<string, { total: number; sprint: number; fl: number; quali: number }> = {};
        const teamScores: Record<string, number> = {};
        allDrivers.forEach(d => driverScores[d.id] = { total: 0, sprint: 0, fl: 0, quali: 0 });
        allConstructors.forEach(c => teamScores[c.id] = 0);

        Object.values(raceResults).forEach((results: EventResult) => {
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
    }, [raceResults, pointsSystem, allDrivers, allConstructors]);

    return (
        <div className="space-y-8 animate-fade-in pt-4 pb-12 h-full overflow-y-auto custom-scrollbar px-1">
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
                        <PolePositionIcon className="w-5 h-5 text-blue-500" /> Qualifying Kings
                    </h3>
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

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ currentUser, raceResults, pointsSystem, allDrivers, allConstructors, events, leaderboardCache, refreshLeaderboard }) => {
  const [view, setView] = useState<ViewState>('menu');
  const [processedUsers, setProcessedUsers] = useState<ProcessedUser[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPaging, setIsPaging] = useState(false);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
      let timer: any;
      if (cooldownTime > 0) timer = setTimeout(() => setCooldownTime(t => t - 1), 1000);
      return () => clearTimeout(timer);
  }, [cooldownTime]);

  const loadProcessedData = async (usersBatch: User[], picksBatch: any, isMore = false) => {
      const processedBatch = await processLeaderboardStats(usersBatch, picksBatch, raceResults, pointsSystem, allDrivers, currentUser);
      if (isMore) {
          setProcessedUsers(prev => [...prev, ...processedBatch]);
      } else {
          setProcessedUsers(processedBatch);
      }
  };

  useEffect(() => {
      if (!leaderboardCache) {
          refreshLeaderboard();
      } else {
          loadProcessedData(leaderboardCache.users, leaderboardCache.allPicks);
          setHasMore(leaderboardCache.users.length === DEFAULT_PAGE_SIZE);
      }
  }, [leaderboardCache, raceResults, pointsSystem, allDrivers, currentUser]);

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
      if (cooldownTime > 0 || isRefreshing) return;
      setIsRefreshing(true);
      setRefreshStatus('idle');
      try {
          await refreshLeaderboard();
          setRefreshStatus('success');
          setCooldownTime(30); 
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

  const isUserAdmin = currentUser && !!currentUser.isAdmin;
  const isLoading = !leaderboardCache && processedUsers.length === 0;

  if (isLoading) return <ListSkeleton rows={10} />;

  if (view === 'menu') {
      return (
          <div className="flex flex-col h-full overflow-hidden w-full max-w-7xl mx-auto animate-fade-in">
              <div className="flex-none pt-4">
                  <PageHeader title="League Standings" icon={LeaderboardIcon} subtitle="Analyze league performance and trends" rightAction={<RefreshControl onClick={handleManualRefresh} isRefreshing={isRefreshing} cooldown={cooldownTime} status={refreshStatus}/>}/>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-0 pb-8 min-h-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                      <NavTile icon={LeaderboardIcon} title="Standings" subtitle="League Table" desc="View the full league table sorted by total points." onClick={() => setView('standings')} />
                      <NavTile icon={TrendingUpIcon} title="Popular Picks" subtitle="Trends" desc="See which drivers and teams are trending this season." onClick={() => setView('popular')} delay="100ms" />
                      <NavTile icon={TeamIcon} title="Teams & Driver Results" subtitle="Breakdown" desc="Real-world performance breakdown with our league scoring system." onClick={() => setView('entities')} delay="200ms" />
                      <NavTile icon={LightbulbIcon} title="Insights" subtitle="Deep Dive" desc="Deep dive into performance breakdowns and superlatives." onClick={() => setView('insights')} delay="300ms" />
                  </div>
              </div>
          </div>
      );
  }

  return (
      <div className="flex flex-col h-full overflow-hidden w-full max-w-7xl mx-auto">
          <div className="flex-none">
              <div className="mb-2 md:mb-4 flex items-center justify-between relative px-2 md:px-0">
                  <div className="flex items-center gap-4">
                      <button onClick={() => setView('menu')} className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors font-bold py-2 z-10 group">
                          <BackIcon className="w-5 h-5 group-hover:-translate-x-1 transition-transform" /> Back to Hub
                      </button>
                  </div>
                  
                  <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
                        <div className="p-2 bg-primary-red/10 rounded-full border border-primary-red/20 shadow-[0_0_15px_rgba(218,41,28,0.2)] hidden sm:flex">
                            {view === 'standings' && <LeaderboardIcon className="w-5 h-5 md:w-6 md:h-6 text-primary-red" />}
                            {view === 'entities' && <TeamIcon className="w-5 h-5 md:w-6 md:h-6 text-primary-red" />}
                            {view === 'popular' && <TrendingUpIcon className="w-5 h-5 md:w-6 md:h-6 text-primary-red" />}
                            {view === 'insights' && <LightbulbIcon className="w-5 h-5 md:w-6 md:h-6 text-primary-red" />}
                        </div>
                        <h1 className="text-lg md:text-2xl font-bold text-pure-white uppercase italic tracking-wider whitespace-nowrap">
                            {view === 'standings' ? 'League Leaderboard' : view === 'entities' ? 'Driver & Team Points' : view === 'popular' ? 'Popular Picks Analysis' : 'Performance Insights'}
                        </h1>
                  </div>
                  
                  <RefreshControl onClick={handleManualRefresh} isRefreshing={isRefreshing} cooldown={cooldownTime} status={refreshStatus} />
              </div>
          </div>

          <div className="flex-1 overflow-hidden px-2 md:px-0 pb-4">
            {view === 'standings' && <StandingsView users={processedUsers} currentUser={currentUser} hasMore={hasMore} onFetchMore={handleFetchMore} isPaging={isPaging} />}
            {view === 'popular' && leaderboardCache && <PopularityView allPicks={leaderboardCache.allPicks} allDrivers={allDrivers} allConstructors={allConstructors} events={events} />}
            {view === 'insights' && leaderboardCache && <InsightsView users={processedUsers} allPicks={leaderboardCache.allPicks} raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} events={events} />}
            {view === 'entities' && <EntityStatsView raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} />}
          </div>
      </div>
  );
};

export default LeaderboardPage;