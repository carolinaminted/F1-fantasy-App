
import React, { useMemo, useState, useEffect } from 'react';
import { calculateScoreRollup, calculatePointsForEvent } from '../services/scoringService.ts';
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
import { AdminIcon } from './icons/AdminIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { CalendarIcon } from './icons/CalendarIcon.tsx';
import { ListSkeleton } from './LoadingSkeleton.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import { PageHeader } from './ui/PageHeader.tsx';

// --- Shared Types & Helpers ---

type ViewState = 'menu' | 'standings' | 'popular' | 'insights' | 'entities';

interface ProcessedUser extends User {
    // Legacy fields preserved for InsightsView usage, but main ranking uses root totalPoints
    breakdown: {
        gp: number;
        quali: number;
        sprint: number;
        fl: number;
    };
    displayRank?: number;
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
}

const getEntityName = (id: string, allDrivers: Driver[], allConstructors: Constructor[]) => {
    return allDrivers.find(d => d.id === id)?.name || allConstructors.find(c => c.id === id)?.name || id;
};

// --- Sub-Components ---

// NEW: Refresh Control Button with Feedback & Cooldown
const RefreshControl: React.FC<{ 
    onClick: () => void; 
    isRefreshing: boolean; 
    cooldown: number;
    status: 'idle' | 'success' | 'error';
}> = ({ onClick, isRefreshing, cooldown, status }) => {
    
    return (
        <div className="relative flex items-center">
            {/* Status Toast */}
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

// ... (Rest of sub-components: NavTile, SimpleBarChart, ConstructorPodium, RaceChart, AccordionItem, StandingsView, PopularityView, InsightsView, EntityStatsView remain unchanged)
const NavTile: React.FC<{ icon: any; title: string; desc: string; onClick: () => void }> = ({ icon: Icon, title, desc, onClick }) => (
    <button
        onClick={onClick}
        className="group relative overflow-hidden bg-carbon-fiber rounded-xl p-8 text-left border border-pure-white/10 hover:border-primary-red/50 shadow-xl hover:shadow-[0_0_20px_rgba(218,41,28,0.15)] transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col"
    >
        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Icon className="w-32 h-32 text-primary-red" />
        </div>
        <div className="relative z-10 flex-grow">
            <Icon className="w-12 h-12 text-primary-red mb-4" />
            <h3 className="text-2xl font-bold text-pure-white mb-2">{title}</h3>
            <p className="text-highlight-silver">{desc}</p>
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
            {/* Podium Visual */}
            <div className="flex justify-center items-end gap-2 md:gap-6 h-56 md:h-72 pt-4 pb-0 relative">
                 {/* P2 (Left) */}
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
                 
                 {/* P1 (Center) */}
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
                 
                 {/* P3 (Right) */}
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

            {/* Rest of Field List */}
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

const RaceChart: React.FC<{ users: ProcessedUser[], limit: FilterLimit }> = ({ users, limit }) => {
    // We calculate maxPoints from the dataset. If empty, default to 1 to avoid /0.
    const maxPoints = Math.max(...users.map(u => u.totalPoints || 0), 1);

    if (users.length === 0) return null;

    // Dynamic Spacing Logic
    const getRowClass = () => {
        if (limit === 10) return 'h-10 md:h-14'; // Spacious for Top 10 on Desktop, Compact on Mobile
        if (limit === 25) return 'h-8 md:h-10'; // Standard for Top 25
        return 'h-7 md:h-8'; // Compact for All
    };
    
    const rowClass = getRowClass();
    
    // Removed fixed scroll container here, letting parent handle scroll
    return (
        <div className="w-full py-2 px-1 md:px-2 md:py-4">
            <div className="relative">
                {/* Finish Line (Vertical Dashed) */}
                <div className="absolute top-0 bottom-0 right-10 md:right-14 w-px border-r-2 border-dashed border-pure-white/10 z-0"></div>

                <div className="space-y-1 relative z-10">
                    {users.map((user, idx) => {
                        const points = user.totalPoints || 0;
                        const rank = user.displayRank || idx + 1;
                        // Calculate percentage relative to max points. 
                        const percent = (points / maxPoints) * 100;
                        
                        // Styling for Top 3
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
                            <div key={user.id} className={`flex items-center gap-2 md:gap-3 ${rowClass} group hover:bg-pure-white/5 rounded-lg px-1 md:px-2 transition-colors`}>
                                {/* Rank */}
                                <div className={`w-6 md:w-8 text-center font-black text-sm md:text-lg ${rankColor} shrink-0`}>
                                    {rank}
                                </div>
                                
                                {/* Name */}
                                <div className="w-24 md:w-60 text-right truncate font-semibold md:font-bold text-[10px] md:text-sm text-highlight-silver group-hover:text-pure-white transition-colors shrink-0">
                                    {user.displayName}
                                </div>

                                {/* Track Lane */}
                                <div className="flex-1 relative h-full flex items-center ml-2 md:ml-8 mr-1 md:mr-2">
                                    {/* Track Line */}
                                    <div className="absolute left-0 right-0 h-px bg-pure-white/10 w-full rounded-full"></div>
                                    
                                    {/* Car Movement */}
                                    <div 
                                        className="relative h-full flex items-center justify-end transition-all duration-1000 ease-out pr-6 md:pr-14"
                                        style={{ width: `${percent}%` }}
                                    >
                                        <div className="relative">
                                            {/* Rotate -90 to point correct way (180 flip from previous) */}
                                            <F1CarIcon className={`w-6 h-6 md:w-8 md:h-8 transform -rotate-90 ${carColor} transition-transform group-hover:scale-110`} />
                                            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-carbon-black border border-pure-white/20 text-pure-white text-[10px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none hidden md:block">
                                                {points} pts
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Points Label */}
                                <div className="w-8 md:w-12 text-right font-mono font-bold text-xs md:text-sm text-pure-white shrink-0">
                                    {points}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- Views ---

type FilterLimit = 10 | 25 | 1000;

interface AccordionItemProps {
    id: 'visual' | 'list';
    title: string;
    icon: any;
    children: React.ReactNode;
    headerExtra?: React.ReactNode;
    isActive: boolean;
    onToggle: (id: 'visual' | 'list') => void;
}

const AccordionItem: React.FC<AccordionItemProps> = ({ 
    id, 
    title, 
    icon: Icon, 
    children, 
    headerExtra,
    isActive,
    onToggle
}) => {
    return (
        <div className={`flex flex-col transition-all duration-300 ease-in-out border border-pure-white/10 rounded-xl overflow-hidden shadow-lg ${isActive ? 'flex-1 min-h-0 ring-1 ring-pure-white/10' : 'flex-none bg-carbon-fiber'}`}>
            <button 
                onClick={() => onToggle(id)}
                className={`flex items-center justify-between p-4 transition-colors relative z-10 ${
                    isActive 
                    ? 'bg-carbon-black text-pure-white border-b border-pure-white/10' 
                    : 'bg-transparent text-highlight-silver hover:text-pure-white hover:border-primary-red/30'
                }`}
            >
                <div className="flex items-center gap-3">
                    <Icon className={`w-6 h-6 ${isActive ? 'text-primary-red' : 'text-highlight-silver'}`} />
                    <span className="font-bold text-lg uppercase tracking-wider italic">{title}</span>
                </div>
                <div className="flex items-center gap-4">
                    {headerExtra}
                    <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`} />
                </div>
            </button>
            <div className={`flex-1 bg-carbon-fiber overflow-hidden flex flex-col relative z-0 ${isActive ? 'opacity-100' : 'max-h-0 opacity-0'}`}>
                {isActive && children}
            </div>
        </div>
    );
};

const StandingsView: React.FC<{ users: ProcessedUser[]; currentUser: User | null }> = ({ users, currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
    const [viewLimit, setViewLimit] = useState<FilterLimit>(25);
    const [activeSection, setActiveSection] = useState<'visual' | 'list'>('visual');

    const { filteredAndSorted, chartData } = useMemo(() => {
        // 1. Sort all users first (Ranking Logic)
        const sorted = [...users].sort((a, b) => {
            const ptsA = a.totalPoints || 0;
            const ptsB = b.totalPoints || 0;
            return sortOrder === 'desc' ? ptsB - ptsA : ptsA - ptsB;
        });

        // Add display ranks based on this global sort
        const ranked = sorted.map((u, i) => ({ ...u, displayRank: i + 1 }));

        // 2. Slice for "Top N" View
        const sliced = ranked.slice(0, viewLimit);

        // 3. Filter by Search
        const result = searchTerm 
            ? sliced.filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
            : sliced;

        return { 
            filteredAndSorted: result,
            chartData: result // Chart reflects exactly what's in the list
        };
    }, [users, searchTerm, sortOrder, viewLimit]);

    const UserCard: React.FC<{ user: ProcessedUser }> = ({ user }) => (
        <div className={`relative overflow-hidden bg-carbon-fiber rounded-lg p-4 flex items-center justify-between border shadow-lg ${user.id === currentUser?.id ? 'border-primary-red' : 'border-pure-white/10'}`}>
            {user.id === currentUser?.id && <div className="absolute inset-0 bg-primary-red/10 pointer-events-none"></div>}
            <div className="flex items-center gap-4 relative z-10">
                <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold text-lg ${
                    user.displayRank === 1 ? 'bg-yellow-500 text-black' :
                    user.displayRank === 2 ? 'bg-gray-300 text-black' :
                    user.displayRank === 3 ? 'bg-orange-600 text-white' :
                    'bg-carbon-black text-highlight-silver border border-pure-white/10'
                }`}>
                    {user.displayRank}
                </div>
                <div>
                    <h3 className="font-bold text-pure-white leading-tight">{user.displayName}</h3>
                    {user.id === currentUser?.id && <span className="text-[10px] text-primary-red uppercase font-bold tracking-wider">You</span>}
                </div>
            </div>
            <div className="text-right relative z-10">
                <span className="block font-mono font-bold text-xl text-primary-red">{user.totalPoints || 0}</span>
                <span className="text-[10px] text-highlight-silver uppercase tracking-wider">PTS</span>
            </div>
        </div>
    );

    const LimitToggle: React.FC<{ label: string; limit: FilterLimit }> = ({ label, limit }) => (
        <button
            onClick={() => setViewLimit(limit)}
            className={`px-3 py-2 text-xs md:text-sm font-bold first:rounded-l-lg last:rounded-r-lg border-y border-l last:border-r transition-colors ${
                viewLimit === limit
                ? 'bg-primary-red text-pure-white border-primary-red z-10 shadow-lg'
                : 'bg-carbon-black text-highlight-silver border-accent-gray hover:bg-accent-gray'
            }`}
        >
            {label}
        </button>
    );

    const raceLeader = Math.max(...users.map(u => u.totalPoints || 0), 0);

    return (
        <div className="flex flex-col gap-4 h-full animate-fade-in pb-safe">
            
            {/* Visual Section */}
            <AccordionItem 
                id="visual" 
                title="League Standings" 
                icon={LeaderboardIcon}
                isActive={activeSection === 'visual'}
                onToggle={setActiveSection}
                headerExtra={
                    activeSection === 'visual' && (
                        <div className="text-xs font-bold text-highlight-silver hidden sm:flex items-center gap-2">
                            Race Leader: {raceLeader} PTS <CheckeredFlagIcon className="w-4 h-4 text-pure-white"/>
                        </div>
                    )
                }
            >
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                     <div className="flex justify-end mb-2">
                        <div className="flex shadow-sm transform scale-90 origin-right">
                            <LimitToggle label="Top 10" limit={10} />
                            <LimitToggle label="Top 25" limit={25} />
                            <LimitToggle label="All" limit={1000} />
                        </div>
                     </div>
                     <RaceChart users={chartData} limit={viewLimit} />
                </div>
            </AccordionItem>

            {/* List Section */}
            <AccordionItem 
                id="list" 
                title="Ranked List" 
                icon={TrendingUpIcon}
                isActive={activeSection === 'list'}
                onToggle={setActiveSection}
            >
                <div className="flex flex-col h-full">
                    {/* Controls */}
                    <div className="p-4 border-b border-pure-white/5 bg-carbon-black/20 flex flex-col md:flex-row gap-3 justify-between items-center flex-shrink-0">
                         <div className="flex shadow-sm">
                            <LimitToggle label="Top 10" limit={10} />
                            <LimitToggle label="Top 25" limit={25} />
                            <LimitToggle label="All" limit={1000} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search current view..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full md:w-64 bg-carbon-black border border-accent-gray rounded-md py-2 px-4 text-pure-white focus:ring-primary-red focus:border-primary-red appearance-none text-sm"
                        />
                    </div>
                    
                    {/* List Content */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                            {filteredAndSorted.map(user => (
                                <UserCard key={user.id} user={user} />
                            ))}
                            {filteredAndSorted.length === 0 && (
                                <div className="p-8 text-center text-highlight-silver italic bg-accent-gray/30 rounded-lg">
                                    No principals found in this view.
                                </div>
                            )}
                        </div>

                        {/* Desktop Table */}
                        <div className="hidden md:block bg-carbon-fiber backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden shadow-2xl">
                            <table className="w-full text-left">
                                <thead className="bg-carbon-black/80 sticky top-0 z-10 backdrop-blur-md">
                                    <tr>
                                        <th className="p-4 text-sm font-semibold uppercase text-highlight-silver w-20 text-center">Rank</th>
                                        <th className="p-4 text-sm font-semibold uppercase text-highlight-silver">Principal</th>
                                        <th className="p-4 text-sm font-semibold uppercase text-highlight-silver text-right cursor-pointer hover:text-pure-white" onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}>
                                            <div className="flex items-center justify-end gap-1">
                                                Total Points
                                                <ChevronDownIcon className={`w-4 h-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAndSorted.map(user => (
                                        <tr key={user.id} className={`border-t border-pure-white/10 hover:bg-pure-white/5 transition-colors ${user.id === currentUser?.id ? 'bg-primary-red/10' : ''}`}>
                                            <td className="p-4 text-center font-bold text-xl text-highlight-silver">{user.displayRank}</td>
                                            <td className="p-4">
                                                <div className="font-bold text-pure-white">{user.displayName}</div>
                                                {user.id === currentUser?.id && <span className="text-xs text-primary-red uppercase font-bold tracking-wider">You</span>}
                                            </td>
                                            <td className="p-4 text-right font-mono font-bold text-lg text-primary-red">{user.totalPoints || 0}</td>
                                        </tr>
                                    ))}
                                    {filteredAndSorted.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-highlight-silver">
                                                No principals found in this view.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </AccordionItem>
        </div>
    );
};

// ... (PopularityView, InsightsView, EntityStatsView remain unchanged)
const PopularityView: React.FC<{ allPicks: { [uid: string]: { [eid: string]: PickSelection } }; allDrivers: Driver[]; allConstructors: Constructor[]; events: Event[] }> = ({ allPicks, allDrivers, allConstructors, events }) => {
    // ... (No Changes)
    const [timeRange, setTimeRange] = useState<'all' | '30' | '60' | '90'>('all'); // mapped to event counts

    const stats = useMemo(() => {
        const teamCounts: { [id: string]: number } = {};
        allConstructors.forEach(c => teamCounts[c.id] = 0);

        const driverCounts: { [id: string]: number } = {};
        allDrivers.forEach(d => driverCounts[d.id] = 0);

        // Determine relevant events based on "Time Range"
        let relevantEvents: Event[] = events;
        if (timeRange === '30') relevantEvents = events.slice(0, 3); 
        if (timeRange === '60') relevantEvents = events.slice(0, 5);
        if (timeRange === '90') relevantEvents = events.slice(0, 8);
        
        const relevantEventIds = new Set(relevantEvents.map(e => e.id));

        Object.values(allPicks).forEach(userPicks => {
            Object.entries(userPicks).forEach(([eventId, picks]) => {
                // Ignore picks that aren't in the current calendar or selected range
                if (!relevantEventIds.has(eventId)) return;

                const teams = [...picks.aTeams, picks.bTeam].filter(Boolean) as string[];
                const drivers = [...picks.aDrivers, picks.bDrivers].filter(Boolean) as string[];

                teams.forEach(t => { if(teamCounts[t] !== undefined) teamCounts[t]++ });
                drivers.forEach(d => { if(driverCounts[d] !== undefined) driverCounts[d]++ });
            });
        });

        // Helper to find color
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
        <div className="space-y-8 animate-fade-in pt-4">
             <div className="flex flex-col md:flex-row justify-end items-center gap-4">
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

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-carbon-fiber rounded-lg p-6 ring-1 ring-pure-white/10 shadow-lg">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider">Most Picked Teams</h3>
                    <SimpleBarChart data={stats.teams} />
                </div>
                 <div className="bg-carbon-fiber rounded-lg p-6 ring-1 ring-pure-white/10 shadow-lg">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider">Most Picked Drivers</h3>
                    <SimpleBarChart data={stats.drivers} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-carbon-fiber rounded-lg p-6 ring-1 ring-pure-white/10 shadow-lg">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider">Least Picked Teams</h3>
                    <SimpleBarChart data={stats.leastTeams} max={Math.max(...stats.teams.map(t => t.value), 1)} />
                </div>
                 <div className="bg-carbon-fiber rounded-lg p-6 ring-1 ring-pure-white/10 shadow-lg">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider">Least Picked Drivers</h3>
                    <SimpleBarChart data={stats.leastDrivers} max={Math.max(...stats.drivers.map(d => d.value), 1)} />
                </div>
            </div>
            
            <div className="bg-accent-gray/30 p-4 rounded-lg text-center text-sm text-highlight-silver border border-pure-white/5">
                Data reflects locked-in selections for {timeRange === 'all' ? 'the entire season' : `the last ${timeRange === '30' ? '3' : timeRange === '60' ? '5' : '8'} race events`}.
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
    // ... (No Changes)
    const superlatives = useMemo(() => {
        if (users.length === 0) return null;
        
        const findMax = (key: keyof ProcessedUser['breakdown']) => {
            const validUsers = users.filter(u => u.breakdown && typeof u.breakdown[key] === 'number');
            if (validUsers.length === 0) return null;

            const sorted = [...validUsers].sort((a, b) => b.breakdown[key] - a.breakdown[key]);
            if (sorted[0].breakdown[key] <= 0) return null;
            
            return { user: sorted[0], score: sorted[0].breakdown[key] };
        };

        return {
            gp: findMax('gp'),
            quali: findMax('quali'),
            sprint: findMax('sprint'),
            fl: findMax('fl'),
        };
    }, [users]);

    const trendData = useMemo(() => {
        const completedEvents = events.filter(e => {
            const r = raceResults[e.id];
            return r && (r.grandPrixFinish?.some(p => p) || !!r.fastestLap);
        });

        const last3Events = completedEvents.slice(-3);
        const last6Events = completedEvents.slice(-6);
        const firstHalfEvents = completedEvents.filter(e => e.round <= 12);
        const secondHalfEvents = completedEvents.filter(e => e.round > 12);

        const getRangeLeaderboard = (eventsSubset: Event[]) => {
            if (eventsSubset.length === 0) return [];
            const userScores = users.map(user => {
                const userPicks = allPicks[user.id] || {};
                let rangeTotal = 0;
                eventsSubset.forEach(event => {
                    const picks = userPicks[event.id];
                    const results = raceResults[event.id];
                    if (picks && results) {
                        const score = calculatePointsForEvent(picks, results, pointsSystem, allDrivers);
                        const safeScore = isNaN(score.totalPoints) ? 0 : score.totalPoints;
                        rangeTotal += safeScore;
                    }
                });
                return { label: user.displayName, value: rangeTotal };
            });
            return userScores
                .filter(u => u.value > 0)
                .sort((a, b) => b.value - a.value)
                .slice(0, 10); // Top 10
        };

        return {
            last3: getRangeLeaderboard(last3Events),
            last6: getRangeLeaderboard(last6Events),
            firstHalf: getRangeLeaderboard(firstHalfEvents),
            secondHalf: getRangeLeaderboard(secondHalfEvents)
        };

    }, [users, allPicks, raceResults, pointsSystem, allDrivers, events]);

    const SuperlativeCard: React.FC<{ title: string; icon: any; data: { user: ProcessedUser; score: number } | null }> = ({ title, icon: Icon, data }) => (
         <div className="bg-carbon-fiber rounded-lg p-4 ring-1 ring-pure-white/10 flex items-center gap-4 shadow-lg h-full">
            <div className="bg-carbon-black p-3 rounded-full text-primary-red border border-pure-white/5 flex-shrink-0">
                <Icon className="w-8 h-8" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-bold text-highlight-silver uppercase tracking-wider truncate">{title}</p>
                {data ? (
                    <>
                        <p className="text-xl font-bold text-pure-white truncate">{data.user.displayName}</p>
                        <p className="text-4xl md:text-5xl font-black text-primary-red font-mono mt-1 leading-none">
                            {Number(data.score || 0).toLocaleString()} <span className="text-xs font-bold text-highlight-silver align-top">PTS</span>
                        </p>
                    </>
                ) : (
                    <p className="text-sm text-highlight-silver italic mt-1">No data yet</p>
                )}
            </div>
        </div>
    );

    const TrendChart: React.FC<{ title: string; data: { label: string; value: number }[]; subtitle: string; icon?: any }> = ({ title, data, subtitle, icon: Icon }) => (
        <div className="bg-carbon-fiber rounded-lg p-6 ring-1 ring-pure-white/10 flex flex-col h-full shadow-lg overflow-hidden">
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
                                            style={{ width: `${(item.value / data[0].value) * 100}%` }}
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
        <div className="flex flex-col h-full gap-4 animate-fade-in pb-safe pt-2">
            <div className="flex-none grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SuperlativeCard title="Race Day Dominator" icon={CheckeredFlagIcon} data={superlatives?.gp || null} />
                <SuperlativeCard title="Qualifying King" icon={PolePositionIcon} data={superlatives?.quali || null} />
                <SuperlativeCard title="Sprint Specialist" icon={SprintIcon} data={superlatives?.sprint || null} />
                <SuperlativeCard title="Fastest Lap Hunter" icon={FastestLapIcon} data={superlatives?.fl || null} />
            </div>

            <div className="flex-1 min-h-0 pb-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                    <TrendChart 
                        title="Hot Streak" 
                        subtitle="Last 3 Races" 
                        data={trendData.last3} 
                        icon={TrendingUpIcon}
                    />
                    <TrendChart 
                        title="Form Guide" 
                        subtitle="Last 6 Races" 
                        data={trendData.last6}
                        icon={LightbulbIcon}
                    />
                    <TrendChart 
                        title="Early Season" 
                        subtitle="First Half (Rounds 1-12)" 
                        data={trendData.firstHalf} 
                        icon={CalendarIcon}
                    />
                    <TrendChart 
                        title="Late Season" 
                        subtitle="Second Half (Rounds 13-24)" 
                        data={trendData.secondHalf} 
                        icon={CalendarIcon}
                    />
                </div>
            </div>
        </div>
    );
};

const EntityStatsView: React.FC<{ raceResults: RaceResults; pointsSystem: PointsSystem; allDrivers: Driver[]; allConstructors: Constructor[] }> = ({ raceResults, pointsSystem, allDrivers, allConstructors }) => {
    // ... (No Changes)
    const stats = useMemo(() => {
        // Init scores
        const driverScores: Record<string, { total: number; sprint: number; fl: number; quali: number }> = {};
        const teamScores: Record<string, number> = {};

        allDrivers.forEach(d => driverScores[d.id] = { total: 0, sprint: 0, fl: 0, quali: 0 });
        allConstructors.forEach(c => teamScores[c.id] = 0);

        // Process Results
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
                
                if (teamId && teamScores[teamId] !== undefined) {
                    teamScores[teamId] += pts;
                }
            };

            // GP Finish
            results.grandPrixFinish.forEach((did, idx) => addPoints(did, pointsSystem.grandPrixFinish[idx] || 0, 'race'));
            // Sprint Finish
            results.sprintFinish?.forEach((did, idx) => addPoints(did, pointsSystem.sprintFinish[idx] || 0, 'sprint'));
            // GP Quali
            results.gpQualifying.forEach((did, idx) => addPoints(did, pointsSystem.gpQualifying[idx] || 0, 'quali'));
            // Sprint Quali
            results.sprintQualifying?.forEach((did, idx) => addPoints(did, pointsSystem.sprintQualifying[idx] || 0, 'quali'));
            
            // Fastest Lap
            if (results.fastestLap) {
                addPoints(results.fastestLap, pointsSystem.fastestLap, 'fl');
                if (driverScores[results.fastestLap]) {
                    driverScores[results.fastestLap].fl += 1;
                }
            }
        });

        // Helper to find color
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

        const formatData = (source: Record<string, any>, valueFn: (k: string) => number, nameFn: (id: string) => string, type: 'team' | 'driver', limit?: number, keepZeros: boolean = false) => {
            return Object.keys(source)
                .map(id => ({ 
                    label: nameFn(id), 
                    value: valueFn(id), 
                    color: getColor(id, type)
                }))
                .sort((a, b) => {
                    if (b.value !== a.value) return b.value - a.value;
                    return a.label.localeCompare(b.label);
                })
                .filter(item => keepZeros || item.value > 0)
                .slice(0, limit);
        };

        const getName = (id: string) => getEntityName(id, allDrivers, allConstructors);

        return {
            teamsTotal: formatData(teamScores, (id) => teamScores[id], getName, 'team', undefined, true),
            driversTotal: formatData(driverScores, (id) => driverScores[id].total, getName, 'driver', 10),
            driversSprint: formatData(driverScores, (id) => driverScores[id].sprint, getName, 'driver', 5),
            driversQuali: formatData(driverScores, (id) => driverScores[id].quali, getName, 'driver', 5),
            driversFL: formatData(driverScores, (id) => driverScores[id].fl, getName, 'driver', 5),
        };

    }, [raceResults, pointsSystem, allDrivers, allConstructors]);

    return (
        <div className="space-y-8 animate-fade-in pt-4">
            
            {/* Header Removed (Moved to Top Nav) */}

            {/* TOP ROW: Constructors Standings */}
            <div className="bg-carbon-fiber shadow-lg rounded-lg p-6 ring-1 ring-pure-white/10">
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-pure-white uppercase tracking-wider flex items-center gap-3">
                        <TeamIcon className="w-6 h-6 text-primary-red"/> Constructor Standings
                    </h3>
                    <p className="text-xs text-highlight-silver italic mt-1 ml-9">* Calculated with league custom scoring system</p>
                </div>
                <ConstructorPodium data={stats.teamsTotal} />
            </div>

            {/* ROW 2: Drivers Total & Sprint */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-carbon-fiber shadow-lg rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider flex items-center gap-2">
                        <CheckeredFlagIcon className="w-5 h-5 text-primary-red"/> Top 10 Drivers (Total)
                    </h3>
                    {stats.driversTotal.length > 0 ? (
                        <SimpleBarChart data={stats.driversTotal} />
                    ) : <p className="text-highlight-silver italic">No points scored yet.</p>}
                </div>

                <div className="bg-carbon-fiber shadow-lg rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider flex items-center gap-2">
                        <SprintIcon className="w-5 h-5 text-yellow-500"/> Top 5 Sprint Performers
                    </h3>
                    {stats.driversSprint.length > 0 ? (
                        <SimpleBarChart data={stats.driversSprint} />
                    ) : <p className="text-highlight-silver italic">No sprint points scored yet.</p>}
                </div>
            </div>

            {/* ROW 3: Quali & Fastest Lap */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-carbon-fiber shadow-lg rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider flex items-center gap-2">
                        <PolePositionIcon className="w-5 h-5 text-blue-500"/> Top 5 Qualifying Performers
                    </h3>
                    {stats.driversQuali.length > 0 ? (
                        <SimpleBarChart data={stats.driversQuali} />
                    ) : <p className="text-highlight-silver italic">No qualifying points scored yet.</p>}
                </div>

                <div className="bg-carbon-fiber shadow-lg rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider flex items-center gap-2">
                        <FastestLapIcon className="w-5 h-5 text-purple-500"/> Fastest Lap Kings (Wins)
                    </h3>
                    {stats.driversFL.length > 0 ? (
                        <SimpleBarChart data={stats.driversFL} max={Math.max(...stats.driversFL.map(d => d.value), 3)} />
                    ) : <p className="text-highlight-silver italic">No fastest laps recorded yet.</p>}
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
  
  const [cooldownTime, setCooldownTime] = useState(0);
  const [refreshStatus, setRefreshStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
      let timer: any;
      if (cooldownTime > 0) {
          timer = setTimeout(() => setCooldownTime(t => t - 1), 1000);
      }
      return () => clearTimeout(timer);
  }, [cooldownTime]);

  useEffect(() => {
      if (!leaderboardCache) {
          refreshLeaderboard();
      } else {
          processLeaderboardData();
      }
  }, [leaderboardCache, raceResults, pointsSystem, allDrivers, currentUser]);

  const processLeaderboardData = () => {
      if (!leaderboardCache) return;

      const { users, allPicks } = leaderboardCache;
      
      const validUsers = users.filter(u => u.displayName !== 'Admin Principal');

      const safeNum = (val: any) => {
          const n = Number(val);
          return Number.isNaN(n) ? 0 : n;
      };

      const processed: ProcessedUser[] = validUsers.map(user => {
          let gp = 0, sprint = 0, quali = 0, fl = 0;
          let totalPoints = 0;

          const userPicks = allPicks[user.id] || {};
          const scoreData = calculateScoreRollup(userPicks, raceResults, pointsSystem, allDrivers);
          
          totalPoints = safeNum(scoreData.totalPoints);
          gp = safeNum(scoreData.grandPrixPoints);
          sprint = safeNum(scoreData.sprintPoints);
          quali = safeNum(scoreData.gpQualifyingPoints) + safeNum(scoreData.sprintQualifyingPoints);
          fl = safeNum(scoreData.fastestLapPoints);

          const isCurrentUser = currentUser && user.id === currentUser.id;
          const displayName = isCurrentUser ? currentUser.displayName : user.displayName;

          return {
              ...user,
              displayName,
              totalPoints,
              rank: user.rank || 0,
              breakdown: { gp, quali, sprint, fl }
          };
      });

      processed.sort((a, b) => b.totalPoints - a.totalPoints);
      processed.forEach((u, i) => u.displayRank = i + 1);

      setProcessedUsers(processed);
  };

  const handleManualRefresh = async () => {
      if (cooldownTime > 0 || isRefreshing) return;

      setIsRefreshing(true);
      setRefreshStatus('idle');

      try {
          await refreshLeaderboard();
          setRefreshStatus('success');
          setCooldownTime(30); 
          
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
  const dataSource = leaderboardCache?.source || 'public';

  if (isLoading) {
      return <ListSkeleton rows={10} />;
  }

  const MigrationWarning = () => (
      <div className="mb-6 bg-red-900/30 border border-primary-red/50 rounded-lg p-4 flex items-start gap-4 animate-pulse-red">
          <div className="bg-primary-red/20 p-2 rounded-full hidden md:block">
              <AdminIcon className="w-6 h-6 text-primary-red" />
          </div>
          <div>
              <h3 className="font-bold text-pure-white text-lg">⚠️ Action Required: Leaderboard Hidden for Players</h3>
              <p className="text-sm text-highlight-silver mt-1">
                  You are viewing <strong>fallback data</strong> (private collection). Regular users currently see an <strong>empty leaderboard</strong>.
              </p>
              <div className="mt-3">
                  <span className="text-xs font-bold text-primary-red uppercase tracking-wider">Fix:</span>
                  <span className="text-sm text-pure-white ml-2">Go to <strong>Admin &gt; Maintenance</strong> and click <strong>"Run PII Security Migration"</strong>.</span>
              </div>
          </div>
      </div>
  );

  if (view === 'menu') {
      return (
          <div className="max-w-7xl mx-auto animate-fade-in pt-4">
              {isUserAdmin && dataSource === 'private_fallback' && <MigrationWarning />}
              
              <PageHeader 
                  title="League Standings" 
                  icon={LeaderboardIcon} 
                  subtitle="Analyze league performance and trends"
                  rightAction={
                      <RefreshControl 
                          onClick={handleManualRefresh} 
                          isRefreshing={isRefreshing} 
                          cooldown={cooldownTime}
                          status={refreshStatus}
                      />
                  }
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <NavTile 
                    icon={LeaderboardIcon} 
                    title="Standings" 
                    desc="View the full league table sorted by total points." 
                    onClick={() => setView('standings')} 
                  />
                  <NavTile 
                    icon={TrendingUpIcon} 
                    title="Popular Picks" 
                    desc="See which drivers and teams are trending this season." 
                    onClick={() => setView('popular')} 
                  />
                   <NavTile 
                    icon={TeamIcon} 
                    title="Teams & Driver Results" 
                    desc="Real-world performance breakdown with our league scoring system." 
                    onClick={() => setView('entities')} 
                  />
                  <NavTile 
                    icon={LightbulbIcon} 
                    title="Insights" 
                    desc="Deep dive into performance breakdowns and superlatives." 
                    onClick={() => setView('insights')} 
                  />
              </div>
          </div>
      );
  }

  return (
      <div className="max-w-7xl mx-auto w-full md:h-[calc(100vh-4.5rem)] md:flex md:flex-col md:overflow-hidden">
          {isUserAdmin && dataSource === 'private_fallback' && <MigrationWarning />}

          <div className="mb-2 md:mb-4 flex items-center justify-between relative flex-none">
              <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setView('menu')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors font-bold py-2 z-10"
                  >
                      <BackIcon className="w-5 h-5" />
                      Back to Hub
                  </button>
              </div>
              
              {(view === 'standings') && (
                  <h1 className="absolute left-1/2 transform -translate-x-1/2 text-xl md:text-2xl font-bold text-pure-white uppercase italic tracking-wider whitespace-nowrap hidden sm:block">
                      League Leaderboard
                  </h1>
              )}

              {/* NEW: Driver & Team Points Title in Header (Desktop) */}
              {(view === 'entities') && (
                  <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3 hidden sm:flex">
                        <div className="p-1.5 bg-primary-red/10 rounded-full border border-primary-red/20 shadow-[0_0_10px_rgba(218,41,28,0.2)]">
                            <TeamIcon className="w-5 h-5 text-primary-red" />
                        </div>
                      <h1 className="text-xl md:text-2xl font-bold text-pure-white uppercase italic tracking-wider whitespace-nowrap">
                          Driver & Team Points
                      </h1>
                  </div>
              )}

              {/* NEW: Popular Picks Title (Desktop) */}
              {(view === 'popular') && (
                  <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3 hidden sm:flex">
                        <div className="p-1.5 bg-primary-red/10 rounded-full border border-primary-red/20 shadow-[0_0_10px_rgba(218,41,28,0.2)]">
                            <TrendingUpIcon className="w-5 h-5 text-primary-red" />
                        </div>
                      <h1 className="text-xl md:text-2xl font-bold text-pure-white uppercase italic tracking-wider whitespace-nowrap">
                          Popular Picks Analysis
                      </h1>
                  </div>
              )}

              {/* NEW: Performance Trends Title (Desktop) */}
              {(view === 'insights') && (
                  <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3 hidden sm:flex">
                        <div className="p-1.5 bg-primary-red/10 rounded-full border border-primary-red/20 shadow-[0_0_10px_rgba(218,41,28,0.2)]">
                            <TrendingUpIcon className="w-5 h-5 text-primary-red" />
                        </div>
                      <h1 className="text-xl md:text-2xl font-bold text-pure-white uppercase italic tracking-wider whitespace-nowrap">
                          Performance Trends
                      </h1>
                  </div>
              )}
              
              <RefreshControl 
                  onClick={handleManualRefresh} 
                  isRefreshing={isRefreshing} 
                  cooldown={cooldownTime} 
                  status={refreshStatus}
              />
          </div>

          {view === 'standings' && (
              <h1 className="text-2xl font-bold text-pure-white uppercase italic tracking-wider sm:hidden mb-4 text-center flex-none">League Leaderboard</h1>
          )}

          {/* NEW: Driver & Team Points Title (Mobile) */}
          {view === 'entities' && (
               <div className="sm:hidden mb-4 flex flex-col items-center justify-center flex-none">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 bg-primary-red/10 rounded-full border border-primary-red/20">
                            <TeamIcon className="w-6 h-6 text-primary-red" />
                        </div>
                        <h1 className="text-2xl font-bold text-pure-white uppercase italic tracking-wider text-center">
                            Driver & Team Points
                        </h1>
                    </div>
                </div>
          )}

          {/* NEW: Popular Picks Title (Mobile) */}
          {view === 'popular' && (
               <div className="sm:hidden mb-4 flex flex-col items-center justify-center flex-none">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 bg-primary-red/10 rounded-full border border-primary-red/20">
                            <TrendingUpIcon className="w-6 h-6 text-primary-red" />
                        </div>
                        <h1 className="text-2xl font-bold text-pure-white uppercase italic tracking-wider text-center">
                            Popular Picks Analysis
                        </h1>
                    </div>
                </div>
          )}

          {/* NEW: Performance Trends Title (Mobile) */}
          {view === 'insights' && (
               <div className="sm:hidden mb-4 flex flex-col items-center justify-center flex-none">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-2 bg-primary-red/10 rounded-full border border-primary-red/20">
                            <TrendingUpIcon className="w-6 h-6 text-primary-red" />
                        </div>
                        <h1 className="text-2xl font-bold text-pure-white uppercase italic tracking-wider text-center">
                            Performance Trends
                        </h1>
                    </div>
                </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-y-hidden custom-scrollbar">
            {view === 'standings' && <StandingsView users={processedUsers} currentUser={currentUser} />}
            {view === 'popular' && leaderboardCache && <div className="h-full overflow-y-auto"><PopularityView allPicks={leaderboardCache.allPicks} allDrivers={allDrivers} allConstructors={allConstructors} events={events} /></div>}
            {view === 'insights' && leaderboardCache && <InsightsView users={processedUsers} allPicks={leaderboardCache.allPicks} raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} events={events} />}
            {view === 'entities' && <div className="h-full overflow-y-auto"><EntityStatsView raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} /></div>}
          </div>
      </div>
  );
};

export default LeaderboardPage;
