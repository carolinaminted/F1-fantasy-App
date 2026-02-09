
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { calculateScoreRollup, processLeaderboardStats } from '../services/scoringService.ts';
import { User, RaceResults, PickSelection, PointsSystem, Event, Driver, Constructor, LeaderboardCache } from '../types.ts';
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
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import { ListSkeleton, ProfileSkeleton } from './LoadingSkeleton.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import { PageHeader } from './ui/PageHeader.tsx';
import { DEFAULT_PAGE_SIZE, getAllUsersAndPicks, fetchAllUserPicks, getUserPicks } from '../services/firestoreService.ts';
import ProfilePage from './ProfilePage.tsx';

// --- Configuration ---
const REFRESH_COOLDOWN_SECONDS = 60;
const MAX_DAILY_REFRESHES = 5;
const LOCKOUT_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  resetToken?: number;
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

    const isLocked = cooldown > 3600; 
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
        <div className="absolute -bottom-6 -right-6 p-0 opacity-[0.03] transition-all transform duration-500 pointer-events-none group-hover:scale-110 group-hover:rotate-12 group-hover:opacity-10 text-pure-white">
            <Icon className="w-48 h-48" />
        </div>
        
        <div className="flex items-start justify-between mb-4 relative z-10">
             <div className="w-12 h-12 rounded-lg flex items-center justify-center transition-colors shadow-lg border bg-carbon-black/50 text-primary-red border-pure-white/5 group-hover:bg-primary-red/20">
                <Icon className="w-6 h-6" />
            </div>
            <p className="text-[10px] font-bold text-highlight-silver uppercase tracking-wider bg-carbon-black/30 px-2 py-1 rounded border border-pure-white/5">{subtitle}</p>
        </div>
        
        <div className="relative z-10 flex-grow flex flex-col justify-center">
            <h3 className="text-2xl font-bold mb-2 transition-colors leading-none text-pure-white group-hover:text-primary-red">{title}</h3>
            <p className="text-highlight-silver/70 text-sm leading-snug">{desc}</p>
        </div>
        
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

// --- View Components ---

const StandingsView: React.FC<{ users: ProcessedUser[], currentUser: User | null, hasMore: boolean, onFetchMore: () => void, isPaging: boolean, onSelectUser: (user: ProcessedUser) => void }> = ({ users, currentUser, hasMore, onFetchMore, isPaging, onSelectUser }) => {
    return (
        <div className="flex flex-col h-full animate-fade-in pb-safe pt-2">
             {/* Header Row */}
             <div className="flex items-center px-4 py-2 text-[10px] font-bold text-highlight-silver uppercase tracking-widest border-b border-pure-white/10 bg-carbon-black/20">
                <div className="w-10 text-center">Rank</div>
                <div className="flex-1">Team Principal</div>
                <div className="w-16 text-right">Points</div>
             </div>
             
             <div className="overflow-y-auto custom-scrollbar flex-1 pb-20">
                {users.map((user, idx) => {
                    const isMe = currentUser?.id === user.id;
                    const rank = user.displayRank || idx + 1;
                    return (
                        <div 
                            key={user.id} 
                            onClick={() => onSelectUser(user)}
                            className={`flex items-center px-4 py-3 border-b border-pure-white/5 cursor-pointer transition-colors ${isMe ? 'bg-primary-red/10 hover:bg-primary-red/20' : 'hover:bg-pure-white/5'}`}
                        >
                            <div className={`w-10 text-center font-black text-lg ${rank <= 3 ? 'text-primary-red' : 'text-highlight-silver'}`}>{rank}</div>
                            <div className="flex-1 min-w-0 pr-4">
                                <div className={`font-bold truncate ${isMe ? 'text-primary-red' : 'text-pure-white'}`}>{user.displayName}</div>
                                {user.breakdown && (
                                    <div className="flex gap-2 text-[10px] text-highlight-silver opacity-70">
                                        <span>GP: {user.breakdown.gp}</span>
                                        <span>•</span>
                                        <span>Sprint: {user.breakdown.sprint}</span>
                                    </div>
                                )}
                            </div>
                            <div className="w-16 text-right font-mono font-bold text-pure-white text-lg">{user.totalPoints}</div>
                        </div>
                    )
                })}
                {hasMore && (
                    <div className="p-4 text-center">
                        <button onClick={onFetchMore} disabled={isPaging} className="text-xs font-bold text-highlight-silver hover:text-pure-white uppercase tracking-widest bg-carbon-black px-6 py-3 rounded-lg border border-pure-white/10 shadow-lg">
                            {isPaging ? 'Loading...' : 'Load More Results'}
                        </button>
                    </div>
                )}
             </div>
        </div>
    )
};

const PopularityView: React.FC<{ 
    allLeaguePicks: { [uid: string]: { [eid: string]: PickSelection } }; 
    allDrivers: Driver[]; 
    allConstructors: Constructor[]; 
    events: Event[];
    isLoading: boolean;
}> = ({ allLeaguePicks, allDrivers, allConstructors, events, isLoading }) => {
    const stats = useMemo(() => {
        const driverCounts: Record<string, number> = {};
        const teamCounts: Record<string, number> = {};
        let totalSelections = 0;

        Object.values(allLeaguePicks).forEach(userPicks => {
            Object.values(userPicks).forEach(pick => {
                totalSelections++;
                [...pick.aDrivers, ...pick.bDrivers].forEach(id => {
                    if (id) driverCounts[id] = (driverCounts[id] || 0) + 1;
                });
                [...pick.aTeams, pick.bTeam].forEach(id => {
                    if (id) teamCounts[id] = (teamCounts[id] || 0) + 1;
                });
            });
        });

        // Normalize scaling for visuals based on total events counted
        // Since each pick selection has multiple drivers, we scale the bar relative to total users * events
        // A rough normalization for bar width visualization
        const normalize = totalSelections > 0 ? totalSelections : 1;

        const sort = (rec: Record<string, number>, list: any[]) => Object.entries(rec)
            .map(([id, count]) => ({ id, count, name: list.find(x => x.id === id)?.name || id }))
            .sort((a, b) => b.count - a.count);

        return {
            drivers: sort(driverCounts, allDrivers),
            teams: sort(teamCounts, allConstructors),
            normalize
        };
    }, [allLeaguePicks, allDrivers, allConstructors]);

    if (isLoading) return <ListSkeleton />;

    return (
        <div className="overflow-y-auto custom-scrollbar h-full pb-safe pt-2 px-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                {/* Drivers */}
                <div className="bg-carbon-fiber rounded-xl p-5 border border-pure-white/10 shadow-lg">
                    <h3 className="text-sm font-bold text-highlight-silver uppercase tracking-widest mb-4 flex items-center gap-2">
                        <DriverIcon className="w-4 h-4 text-primary-red"/> Popular Drivers
                    </h3>
                    {stats.drivers.slice(0, 10).map((d, i) => (
                        <div key={d.id} className="flex items-center justify-between mb-3 last:mb-0 group">
                            <span className="text-sm text-pure-white font-semibold truncate w-1/2 flex items-center gap-2">
                                <span className="text-highlight-silver w-4 text-right">{i+1}.</span> 
                                {d.name}
                            </span>
                            <div className="flex items-center gap-2 w-1/2 justify-end">
                                <div className="h-2 bg-carbon-black rounded-full flex-1 overflow-hidden border border-pure-white/5">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (d.count / stats.normalize) * 100 * 3)}%` }}></div> 
                                </div>
                                <span className="text-xs font-mono text-highlight-silver w-8 text-right">{d.count}</span>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Teams */}
                <div className="bg-carbon-fiber rounded-xl p-5 border border-pure-white/10 shadow-lg">
                    <h3 className="text-sm font-bold text-highlight-silver uppercase tracking-widest mb-4 flex items-center gap-2">
                        <TeamIcon className="w-4 h-4 text-primary-red"/> Popular Teams
                    </h3>
                    {stats.teams.slice(0, 10).map((t, i) => (
                        <div key={t.id} className="flex items-center justify-between mb-3 last:mb-0 group">
                            <span className="text-sm text-pure-white font-semibold truncate w-1/2 flex items-center gap-2">
                                <span className="text-highlight-silver w-4 text-right">{i+1}.</span>
                                {t.name}
                            </span>
                            <div className="flex items-center gap-2 w-1/2 justify-end">
                                <div className="h-2 bg-carbon-black rounded-full flex-1 overflow-hidden border border-pure-white/5">
                                    <div className="h-full bg-primary-red rounded-full" style={{ width: `${Math.min(100, (t.count / stats.normalize) * 100 * 2)}%` }}></div>
                                </div>
                                <span className="text-xs font-mono text-highlight-silver w-8 text-right">{t.count}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// --- Enhanced Superlative Card & TrendChart for Insights ---

type InsightVariant = 'gp' | 'quali' | 'sprint' | 'fl' | 'total';

const getVariantStyles = (variant: InsightVariant) => {
    switch (variant) {
        case 'gp': return { text: 'text-primary-red', bg: 'bg-primary-red', border: 'border-primary-red', gradient: 'from-primary-red/10' };
        case 'quali': return { text: 'text-blue-500', bg: 'bg-blue-500', border: 'border-blue-500', gradient: 'from-blue-500/10' };
        case 'sprint': return { text: 'text-yellow-500', bg: 'bg-yellow-500', border: 'border-yellow-500', gradient: 'from-yellow-500/10' };
        case 'fl': return { text: 'text-purple-500', bg: 'bg-purple-500', border: 'border-purple-500', gradient: 'from-purple-500/10' };
        case 'total': return { text: 'text-orange-500', bg: 'bg-orange-500', border: 'border-orange-500', gradient: 'from-orange-500/10' };
        default: return { text: 'text-pure-white', bg: 'bg-pure-white', border: 'border-pure-white', gradient: 'from-pure-white/5' };
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
    const styles = getVariantStyles(variant);
    
    return (
        <button 
            onClick={onClick}
            className={`w-full text-left group relative overflow-hidden rounded-xl p-5 shadow-lg h-full border transition-all duration-300 outline-none
                ${isActive 
                    ? `bg-carbon-fiber ring-2 ${styles.border} ring-opacity-50 opacity-100 scale-[1.02] z-10` 
                    : 'bg-carbon-fiber/60 border-pure-white/5 opacity-60 hover:opacity-100 hover:scale-[1.01] hover:border-pure-white/20'
                }
            `}
        >
            {/* Background Gradient & Pattern */}
            <div className={`absolute inset-0 bg-gradient-to-br ${styles.gradient} to-transparent opacity-0 ${isActive ? 'opacity-20' : 'group-hover:opacity-10'} transition-opacity duration-500`}></div>
            <div className="absolute inset-0 bg-checkered-flag opacity-[0.03] pointer-events-none"></div>
            
            <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="mb-2">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg bg-carbon-black border border-pure-white/10 ${styles.text} shadow-inner`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? styles.text : 'text-highlight-silver'} opacity-80 truncate`}>{title}</span>
                    </div>
                    
                    {data ? (
                        <div className="mt-1">
                            <p className="text-sm md:text-base font-bold text-pure-white truncate leading-tight mb-0.5">{data.user.displayName}</p>
                            <p className={`text-xl md:text-2xl font-black font-mono ${styles.text} drop-shadow-sm leading-none`}>
                                {Number(data.score || 0).toLocaleString()}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-2">
                            <p className="text-xs text-highlight-silver italic opacity-50">No data</p>
                        </div>
                    )}
                </div>
            </div>
        </button>
    );
};

const TopListRow: React.FC<{ item: { label: string, value: number }, idx: number, styles: any, maxVal: number }> = ({ item, idx, styles, maxVal }) => (
    <div className="group/row">
        <div className="flex justify-between items-end mb-1 text-sm">
            <div className="flex items-center gap-3">
                <span className={`font-mono font-bold w-6 ${idx < 3 ? styles.text : 'text-highlight-silver opacity-70'}`}>
                    {idx + 1}.
                </span>
                <span className="font-semibold text-ghost-white truncate max-w-[150px] sm:max-w-[200px]">
                    {item.label}
                </span>
            </div>
            <span className={`font-mono font-bold ${idx === 0 ? styles.text : 'text-pure-white'}`}>
                {item.value}
            </span>
        </div>
        <div className="w-full bg-carbon-black rounded-full h-2.5 border border-pure-white/5 overflow-hidden">
            <div 
                className={`h-full rounded-full transition-all duration-700 ease-out ${styles.bg} ${idx === 0 ? 'opacity-100 shadow-[0_0_10px_currentColor]' : 'opacity-60 group-hover/row:opacity-100'}`} 
                style={{ width: `${(item.value / maxVal) * 100}%` }}
            />
        </div>
    </div>
);

const InsightsView: React.FC<{ 
    users: ProcessedUser[]; 
    allPicks: { [uid: string]: { [eid: string]: PickSelection } }; 
    raceResults: RaceResults;
    pointsSystem: PointsSystem;
    allDrivers: Driver[];
    events: Event[];
}> = ({ users, allPicks, raceResults, pointsSystem, allDrivers, events }) => {
    const [activeCategory, setActiveCategory] = useState<InsightVariant>('total');

    const superlatives = useMemo(() => {
        if (users.length === 0) return null;
        
        const findMax = (key: keyof NonNullable<ProcessedUser['breakdown']>) => {
            const validUsers = users.filter(u => u.breakdown && typeof u.breakdown[key] === 'number');
            if (validUsers.length === 0) return null;
            const sorted = [...validUsers].sort((a, b) => (b.breakdown?.[key] || 0) - (a.breakdown?.[key] || 0));
            if ((sorted[0].breakdown?.[key] || 0) <= 0) return null;
            return { user: sorted[0], score: sorted[0].breakdown![key] };
        };

        const findMaxTotal = () => {
             const sorted = [...users].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
             return { user: sorted[0], score: sorted[0].totalPoints || 0 };
        };

        return { 
            total: findMaxTotal(),
            gp: findMax('gp'), 
            quali: findMax('quali'), 
            sprint: findMax('sprint'), 
            fl: findMax('fl') 
        };
    }, [users]);

    const chartData = useMemo(() => {
        const sortedBy = (key: keyof NonNullable<ProcessedUser['breakdown']>) => 
            [...users]
                .filter(u => u.breakdown)
                .sort((a, b) => (b.breakdown![key] || 0) - (a.breakdown![key] || 0))
                .slice(0, 10)
                .map(u => ({ label: u.displayName, value: u.breakdown![key] || 0 }));

        return {
            total: [...users].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0)).slice(0, 10).map(u => ({ label: u.displayName, value: u.totalPoints || 0 })),
            gp: sortedBy('gp'),
            quali: sortedBy('quali'),
            sprint: sortedBy('sprint'),
            fl: sortedBy('fl')
        };
    }, [users]);

    const activeList = chartData[activeCategory] || [];
    const activeStyles = getVariantStyles(activeCategory);
    const maxVal = Math.max(...activeList.map(d => d.value), 1);

    const getTitle = (cat: InsightVariant) => {
        switch(cat) {
            case 'total': return 'Season Leaderboard (Top 10)';
            case 'gp': return 'Grand Prix Points (Top 10)';
            case 'quali': return 'Qualifying Points (Top 10)';
            case 'sprint': return 'Sprint Points (Top 10)';
            case 'fl': return 'Fastest Lap Points (Top 10)';
        }
    };

    const getIcon = (cat: InsightVariant) => {
        switch(cat) {
            case 'total': return TrophyIcon;
            case 'gp': return CheckeredFlagIcon;
            case 'quali': return PolePositionIcon;
            case 'sprint': return SprintIcon;
            case 'fl': return FastestLapIcon;
        }
    };

    const ActiveIcon = getIcon(activeCategory);

    return (
        <div className="flex flex-col h-full gap-6 animate-fade-in pb-safe pt-2 overflow-y-auto custom-scrollbar pr-1">
            {/* Top Interactive Tiles */}
            <div className="flex-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <SuperlativeCard 
                    title="Season Leader" 
                    icon={TrophyIcon} 
                    data={superlatives?.total || null} 
                    variant="total" 
                    isActive={activeCategory === 'total'}
                    onClick={() => setActiveCategory('total')}
                />
                <SuperlativeCard 
                    title="Race Day Dominator" 
                    icon={CheckeredFlagIcon} 
                    data={superlatives?.gp || null} 
                    variant="gp" 
                    isActive={activeCategory === 'gp'}
                    onClick={() => setActiveCategory('gp')}
                />
                <SuperlativeCard 
                    title="Qualifying King" 
                    icon={PolePositionIcon} 
                    data={superlatives?.quali || null} 
                    variant="quali" 
                    isActive={activeCategory === 'quali'}
                    onClick={() => setActiveCategory('quali')}
                />
                <SuperlativeCard 
                    title="Sprint Specialist" 
                    icon={SprintIcon} 
                    data={superlatives?.sprint || null} 
                    variant="sprint" 
                    isActive={activeCategory === 'sprint'}
                    onClick={() => setActiveCategory('sprint')}
                />
                <SuperlativeCard 
                    title="Fastest Lap Hunter" 
                    icon={FastestLapIcon} 
                    data={superlatives?.fl || null} 
                    variant="fl" 
                    isActive={activeCategory === 'fl'}
                    onClick={() => setActiveCategory('fl')}
                />
            </div>

            {/* Consolidated List Section */}
            <div className="flex-none bg-carbon-fiber rounded-xl p-6 ring-1 ring-pure-white/10 shadow-xl border border-pure-white/5 mb-8 transition-all duration-500">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-pure-white/5">
                    <div className={`p-2 rounded-lg bg-carbon-black border border-pure-white/10 ${activeStyles.text}`}>
                        <ActiveIcon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-pure-white">{getTitle(activeCategory)}</h3>
                </div>

                {activeList.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {/* Left Column (1-5) */}
                        <div className="space-y-4">
                            {activeList.slice(0, 5).map((item, idx) => (
                                <TopListRow key={idx} item={item} idx={idx} styles={activeStyles} maxVal={maxVal} />
                            ))}
                        </div>
                        {/* Right Column (6-10) */}
                        <div className="space-y-4">
                            {activeList.slice(5, 10).map((item, idx) => (
                                <TopListRow key={idx + 5} item={item} idx={idx + 5} styles={activeStyles} maxVal={maxVal} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="py-12 text-center text-highlight-silver italic opacity-50">
                        No data available for this category yet.
                    </div>
                )}
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
        <div className="flex flex-col h-full animate-fade-in pb-safe pt-2 overflow-y-auto custom-scrollbar pr-1">
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
  
  const [allLeaguePicks, setAllLeaguePicks] = useState<{ [uid: string]: { [eid: string]: PickSelection } }>({});
  const [isFetchingGlobalPicks, setIsFetchingGlobalPicks] = useState(false);

  const [selectedUserProfile, setSelectedUserProfile] = useState<ProcessedUser | null>(null);
  const [modalPicks, setModalPicks] = useState<any>(null);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);

  const [refreshPolicy, setRefreshPolicy] = useState<RefreshPolicy>(() => {
        const saved = localStorage.getItem('lb_refresh_policy');
        return saved ? JSON.parse(saved) : { count: 0, lastRefresh: 0, dayStart: Date.now(), lockedUntil: 0 };
  });

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

  useEffect(() => {
      const checkPolicyIntegrity = () => {
          const now = Date.now();
          const stored = localStorage.getItem('lb_refresh_policy');
          if (stored) {
              const p = JSON.parse(stored);
              
              if (now - p.dayStart > 24 * 60 * 60 * 1000) {
                  const newP = { count: 0, lastRefresh: 0, dayStart: now, lockedUntil: 0 };
                  localStorage.setItem('lb_refresh_policy', JSON.stringify(newP));
                  setRefreshPolicy(newP);
                  setCooldownTime(0);
                  return;
              }

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

  useEffect(() => {
    if (selectedUserProfile) {
        const cached = leaderboardCache?.allPicks?.[selectedUserProfile.id];
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

  const loadProcessedData = useCallback(async (usersBatch: User[], picksBatch: any, isMore = false) => {
      const processedBatch = await processLeaderboardStats(usersBatch, picksBatch, raceResults, pointsSystem, allDrivers, currentUser);
      if (isMore) {
          setProcessedUsers(prev => [...prev, ...processedBatch]);
      } else {
          setProcessedUsers(processedBatch);
      }
  }, [raceResults, pointsSystem, allDrivers, currentUser]);

  useEffect(() => {
      if (cooldownTime <= 0) return;
      const timer = setInterval(() => {
          setCooldownTime(prev => {
              if (prev <= 1) {
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

  useEffect(() => {
    if (resetToken !== undefined) {
      setView('menu');
    }
  }, [resetToken]);

  useEffect(() => {
      if (!leaderboardCache) {
          refreshLeaderboard();
      } else {
          loadProcessedData(leaderboardCache.users, leaderboardCache.allPicks);
          setHasMore(leaderboardCache.users.length === DEFAULT_PAGE_SIZE);
      }
  }, [leaderboardCache]); 

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
      if (cooldownTime > 0 || isRefreshing) return;

      const now = Date.now();
      
      let currentPolicy = { ...refreshPolicy };
      if (now - currentPolicy.dayStart > 24 * 60 * 60 * 1000) {
          currentPolicy = { count: 0, lastRefresh: 0, dayStart: now, lockedUntil: 0 };
      }

      if (currentPolicy.count >= MAX_DAILY_REFRESHES) {
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
          if (view === 'popular') {
              setIsFetchingGlobalPicks(true);
              const picks = await fetchAllUserPicks();
              setAllLeaguePicks(picks);
              setIsFetchingGlobalPicks(false);
          }
          setRefreshStatus('success');
          
          const newCount = currentPolicy.count + 1;
          let newLockedUntil = 0;
          let newCooldown = REFRESH_COOLDOWN_SECONDS;

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

  const userToDisplay = (currentUser && selectedUserProfile && currentUser.id === selectedUserProfile.id) 
    ? { ...selectedUserProfile, ...currentUser } 
    : selectedUserProfile;

  return (
      <div className="flex flex-col h-full overflow-hidden w-full max-w-7xl mx-auto">
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

          <div className="flex-1 overflow-hidden px-2 md:px-0 pb-4">
            {view === 'standings' && <StandingsView users={processedUsers} currentUser={currentUser} hasMore={hasMore} onFetchMore={handleFetchMore} isPaging={isPaging} onSelectUser={setSelectedUserProfile} />}
            {view === 'popular' && <PopularityView allLeaguePicks={allLeaguePicks} allDrivers={allDrivers} allConstructors={allConstructors} events={events} isLoading={isFetchingGlobalPicks} />}
            {view === 'insights' && leaderboardCache && <InsightsView users={processedUsers} allPicks={leaderboardCache.allPicks} raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} events={events} />}
            {view === 'entities' && <EntityStatsView raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} events={events} />}
            {view === 'p22' && <P22View users={processedUsers} />}
          </div>

          {selectedUserProfile && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-carbon-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setSelectedUserProfile(null)}>
                <div className="bg-carbon-black border border-pure-white/10 rounded-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative" onClick={e => e.stopPropagation()}>
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
