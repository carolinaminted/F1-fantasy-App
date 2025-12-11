
import React, { useMemo, useState, useEffect } from 'react';
import { EVENTS, CONSTRUCTORS } from '../constants.ts';
import { calculateScoreRollup } from '../services/scoringService.ts';
import { User, RaceResults, PickSelection, PointsSystem, Event, Driver, Constructor, EventResult } from '../types.ts';
import { getAllUsersAndPicks } from '../services/firestoreService.ts';
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

// --- Shared Types & Helpers ---

type ViewState = 'menu' | 'standings' | 'popular' | 'insights' | 'entities';
const CURRENT_EVENT_IDS = new Set(EVENTS.map(e => e.id));

interface ProcessedUser extends User {
    points: number;
    rank: number;
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
}

const getEntityName = (id: string, allDrivers: Driver[], allConstructors: Constructor[]) => {
    return allDrivers.find(d => d.id === id)?.name || allConstructors.find(c => c.id === id)?.name || id;
};

// --- Sub-Components ---

const NavTile: React.FC<{ icon: any; title: string; desc: string; onClick: () => void }> = ({ icon: Icon, title, desc, onClick }) => (
    <button
        onClick={onClick}
        className="group relative overflow-hidden bg-accent-gray/50 backdrop-blur-sm rounded-xl p-8 text-left ring-1 ring-pure-white/10 hover:ring-primary-red transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col"
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
                        <div className="flex-1 h-3 md:h-4 bg-carbon-black rounded-full overflow-hidden">
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

// --- Views ---

const StandingsView: React.FC<{ users: ProcessedUser[]; currentUser: User | null }> = ({ users, currentUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    const filteredAndSorted = useMemo(() => {
        let result = [...users];
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(u => u.displayName.toLowerCase().includes(lower));
        }
        result.sort((a, b) => sortOrder === 'desc' ? b.points - a.points : a.points - b.points);
        return result.map((u, i) => ({ ...u, displayRank: i + 1 }));
    }, [users, searchTerm, sortOrder]);

    const UserCard: React.FC<{ user: ProcessedUser }> = ({ user }) => (
        <div className={`bg-accent-gray/50 rounded-lg p-4 flex items-center justify-between border ${user.id === currentUser?.id ? 'border-primary-red bg-primary-red/10' : 'border-pure-white/5'}`}>
            <div className="flex items-center gap-4">
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
            <div className="text-right">
                <span className="block font-mono font-bold text-xl text-primary-red">{user.points}</span>
                <span className="text-[10px] text-highlight-silver uppercase tracking-wider">PTS</span>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <h2 className="text-2xl font-bold text-pure-white">League Standings</h2>
                <input
                    type="text"
                    placeholder="Search principals..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-64 bg-carbon-black/70 border border-accent-gray rounded-md py-2 px-4 text-pure-white focus:ring-primary-red focus:border-primary-red appearance-none"
                />
            </div>

            {/* Mobile: Vertical Card List */}
            <div className="md:hidden space-y-3">
                {filteredAndSorted.map(user => (
                    <UserCard key={user.id} user={user} />
                ))}
                {filteredAndSorted.length === 0 && (
                     <div className="p-8 text-center text-highlight-silver italic bg-accent-gray/30 rounded-lg">No principals found.</div>
                )}
            </div>

            {/* Desktop: Table View */}
            <div className="hidden md:block bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-carbon-black/50">
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
                            <tr key={user.id} className={`border-t border-accent-gray/50 hover:bg-pure-white/5 ${user.id === currentUser?.id ? 'bg-primary-red/10' : ''}`}>
                                <td className="p-4 text-center font-bold text-xl text-highlight-silver">{user.displayRank}</td>
                                <td className="p-4">
                                    <div className="font-bold text-pure-white">{user.displayName}</div>
                                    {user.id === currentUser?.id && <span className="text-xs text-primary-red uppercase font-bold tracking-wider">You</span>}
                                </td>
                                <td className="p-4 text-right font-mono font-bold text-lg text-primary-red">{user.points}</td>
                            </tr>
                        ))}
                        {filteredAndSorted.length === 0 && (
                            <tr><td colSpan={3} className="p-8 text-center text-highlight-silver">No principals found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const PopularityView: React.FC<{ allPicks: { [uid: string]: { [eid: string]: PickSelection } }; allDrivers: Driver[]; allConstructors: Constructor[] }> = ({ allPicks, allDrivers, allConstructors }) => {
    const [timeRange, setTimeRange] = useState<'all' | '30' | '60' | '90'>('all'); // mapped to event counts

    const stats = useMemo(() => {
        const teamCounts: { [id: string]: number } = {};
        allConstructors.forEach(c => teamCounts[c.id] = 0);

        const driverCounts: { [id: string]: number } = {};
        allDrivers.forEach(d => driverCounts[d.id] = 0);

        // Determine relevant events based on "Time Range"
        let relevantEvents: Event[] = EVENTS;
        if (timeRange === '30') relevantEvents = EVENTS.slice(0, 3); 
        if (timeRange === '60') relevantEvents = EVENTS.slice(0, 5);
        if (timeRange === '90') relevantEvents = EVENTS.slice(0, 8);
        
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
    }, [allPicks, timeRange, allDrivers, allConstructors]);

    return (
        <div className="space-y-8 animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-pure-white">Popular Picks Analysis</h2>
                <div className="flex bg-accent-gray rounded-lg p-1 w-full md:w-auto overflow-x-auto">
                    {(['all', '30', '60', '90'] as const).map(range => (
                         <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-1.5 rounded-md text-xs md:text-sm font-bold transition-colors whitespace-nowrap flex-1 ${
                                timeRange === range ? 'bg-primary-red text-pure-white' : 'text-highlight-silver hover:text-pure-white'
                            }`}
                        >
                            {range === 'all' ? 'Season' : `${range} Days`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider">Most Picked Teams</h3>
                    <SimpleBarChart data={stats.teams} />
                </div>
                 <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider">Most Picked Drivers</h3>
                    <SimpleBarChart data={stats.drivers} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider">Least Picked Teams</h3>
                    <SimpleBarChart data={stats.leastTeams} max={Math.max(...stats.teams.map(t => t.value), 1)} />
                </div>
                 <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider">Least Picked Drivers</h3>
                    <SimpleBarChart data={stats.leastDrivers} max={Math.max(...stats.drivers.map(d => d.value), 1)} />
                </div>
            </div>
            
            <div className="bg-accent-gray/30 p-4 rounded-lg text-center text-sm text-highlight-silver">
                Data reflects locked-in selections for {timeRange === 'all' ? 'the entire season' : `the last ${timeRange === '30' ? '3' : timeRange === '60' ? '5' : '8'} race events`}.
            </div>
        </div>
    );
};

const InsightsView: React.FC<{ users: ProcessedUser[] }> = ({ users }) => {
    // Calculate Superlatives
    const superlatives = useMemo(() => {
        if (users.length === 0) return null;
        
        const findMax = (key: keyof ProcessedUser['breakdown']) => {
            const sorted = [...users].sort((a, b) => b.breakdown[key] - a.breakdown[key]);
            if (sorted[0].breakdown[key] === 0) return null;
            return { user: sorted[0], score: sorted[0].breakdown[key] };
        };

        return {
            gp: findMax('gp'),
            quali: findMax('quali'),
            sprint: findMax('sprint'),
            fl: findMax('fl'),
        };
    }, [users]);

    const Card: React.FC<{ title: string; icon: any; data: { user: ProcessedUser; score: number } | null }> = ({ title, icon: Icon, data }) => (
         <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10 flex items-center gap-4">
            <div className="bg-carbon-black p-3 rounded-full text-primary-red">
                <Icon className="w-8 h-8" />
            </div>
            <div>
                <p className="text-xs font-bold text-highlight-silver uppercase tracking-wider">{title}</p>
                {data ? (
                    <>
                        <p className="text-xl font-bold text-pure-white truncate max-w-[150px]">{data.user.displayName}</p>
                        <p className="text-sm text-primary-red font-mono">{data.score} pts</p>
                    </>
                ) : (
                    <p className="text-sm text-highlight-silver italic mt-1">No data yet</p>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-pure-white">Season Insights & Trends</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card title="Race Day Dominator" icon={CheckeredFlagIcon} data={superlatives?.gp || null} />
                <Card title="Qualifying King" icon={PolePositionIcon} data={superlatives?.quali || null} />
                <Card title="Sprint Specialist" icon={SprintIcon} data={superlatives?.sprint || null} />
                <Card title="Fastest Lap Hunter" icon={FastestLapIcon} data={superlatives?.fl || null} />
            </div>

            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10">
                <h3 className="text-lg font-bold text-pure-white mb-6">Top 5 Breakdown by Category</h3>
                {users.length === 0 ? (
                    <p className="text-highlight-silver text-center">No data available.</p>
                ) : (
                    <div className="space-y-6">
                        {users.slice(0, 5).map(user => (
                            <div key={user.id}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-bold text-ghost-white">{user.displayName}</span>
                                    <span className="font-mono text-highlight-silver">{user.points} pts</span>
                                </div>
                                <div className="flex h-3 rounded-full overflow-hidden bg-carbon-black">
                                    {user.points > 0 ? (
                                        <>
                                            <div title={`GP: ${user.breakdown.gp}`} className="bg-primary-red h-full" style={{ width: `${(user.breakdown.gp / user.points) * 100}%` }} />
                                            <div title={`Quali: ${user.breakdown.quali}`} className="bg-blue-500 h-full" style={{ width: `${(user.breakdown.quali / user.points) * 100}%` }} />
                                            <div title={`Sprint: ${user.breakdown.sprint}`} className="bg-yellow-500 h-full" style={{ width: `${(user.breakdown.sprint / user.points) * 100}%` }} />
                                            <div title={`FL: ${user.breakdown.fl}`} className="bg-purple-500 h-full" style={{ width: `${(user.breakdown.fl / user.points) * 100}%` }} />
                                        </>
                                    ) : (
                                        <div className="w-full h-full bg-accent-gray opacity-20"></div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex gap-4 justify-center mt-4 text-xs text-highlight-silver flex-wrap">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-primary-red rounded-sm"></div> Race</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Quali</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded-sm"></div> Sprint</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-500 rounded-sm"></div> FL</div>
                </div>
            </div>
        </div>
    );
};

const EntityStatsView: React.FC<{ raceResults: RaceResults; pointsSystem: PointsSystem; allDrivers: Driver[]; allConstructors: Constructor[] }> = ({ raceResults, pointsSystem, allDrivers, allConstructors }) => {
    
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
                
                // Add to driver
                if (driverScores[driverId]) {
                    driverScores[driverId].total += pts;
                    if (category === 'sprint') driverScores[driverId].sprint += pts;
                    if (category === 'quali') driverScores[driverId].quali += pts;
                }

                // Add to team
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
                    driverScores[results.fastestLap].fl += 1; // Count wins
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

        // Format
        const formatData = (source: Record<string, any>, valueFn: (k: string) => number, nameFn: (id: string) => string, type: 'team' | 'driver', limit?: number) => {
            return Object.keys(source)
                .map(id => ({ 
                    label: nameFn(id), 
                    value: valueFn(id), 
                    color: getColor(id, type)
                }))
                .sort((a, b) => b.value - a.value)
                .filter(item => item.value > 0)
                .slice(0, limit);
        };

        const getName = (id: string) => getEntityName(id, allDrivers, allConstructors);

        return {
            teamsTotal: formatData(teamScores, (id) => teamScores[id], getName, 'team'),
            driversTotal: formatData(driverScores, (id) => driverScores[id].total, getName, 'driver', 10),
            driversSprint: formatData(driverScores, (id) => driverScores[id].sprint, getName, 'driver', 5),
            driversQuali: formatData(driverScores, (id) => driverScores[id].quali, getName, 'driver', 5),
            driversFL: formatData(driverScores, (id) => driverScores[id].fl, getName, 'driver', 5),
        };

    }, [raceResults, pointsSystem, allDrivers, allConstructors]);

    return (
        <div className="space-y-8 animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-pure-white">Driver & Team Points</h2>
                <div className="text-sm text-highlight-silver bg-accent-gray/30 px-3 py-1 rounded-full border border-pure-white/10 text-center">
                    Based on Official Race Results
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Constructors Total */}
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider flex items-center gap-2">
                        <TeamIcon className="w-5 h-5 text-primary-red"/> Constructor Standings
                    </h3>
                    {stats.teamsTotal.length > 0 ? (
                        <SimpleBarChart data={stats.teamsTotal} />
                    ) : <p className="text-highlight-silver italic">No points scored yet.</p>}
                </div>

                {/* Drivers Total */}
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider flex items-center gap-2">
                        <CheckeredFlagIcon className="w-5 h-5 text-primary-red"/> Top 10 Drivers (Total)
                    </h3>
                    {stats.driversTotal.length > 0 ? (
                        <SimpleBarChart data={stats.driversTotal} />
                    ) : <p className="text-highlight-silver italic">No points scored yet.</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Drivers Sprint */}
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider flex items-center gap-2">
                        <SprintIcon className="w-5 h-5 text-yellow-500"/> Top 5 Sprint Performers
                    </h3>
                    {stats.driversSprint.length > 0 ? (
                        <SimpleBarChart data={stats.driversSprint} />
                    ) : <p className="text-highlight-silver italic">No sprint points scored yet.</p>}
                </div>

                {/* Drivers Qualifying */}
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10">
                    <h3 className="text-lg font-bold text-highlight-silver mb-4 uppercase tracking-wider flex items-center gap-2">
                        <PolePositionIcon className="w-5 h-5 text-blue-500"/> Top 5 Qualifying Performers
                    </h3>
                    {stats.driversQuali.length > 0 ? (
                        <SimpleBarChart data={stats.driversQuali} />
                    ) : <p className="text-highlight-silver italic">No qualifying points scored yet.</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Fastest Laps */}
                <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10">
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

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({ currentUser, raceResults, pointsSystem, allDrivers, allConstructors }) => {
  const [view, setView] = useState<ViewState>('menu');
  const [processedUsers, setProcessedUsers] = useState<ProcessedUser[]>([]);
  const [allPicks, setAllPicks] = useState<{ [uid: string]: { [eid: string]: PickSelection } }>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        const { users, allPicks: picksData } = await getAllUsersAndPicks();
        
        // Filter out the global admin account from leaderboard data
        const validUsers = users.filter(u => u.email !== 'admin@fantasy.f1');

        // Filter picks to match valid users (for PopularityView)
        const validPicks: { [uid: string]: { [eid: string]: PickSelection } } = {};
        validUsers.forEach(u => {
            if (picksData[u.id]) {
                validPicks[u.id] = picksData[u.id];
            }
        });

        setAllPicks(validPicks);

        const processed = validUsers.map(user => {
            const userPicks = picksData[user.id] || {};
            const scoreData = calculateScoreRollup(userPicks, raceResults, pointsSystem, allDrivers);

            return {
                ...user,
                points: scoreData.totalPoints,
                rank: 0,
                breakdown: {
                    gp: scoreData.grandPrixPoints,
                    quali: scoreData.gpQualifyingPoints + scoreData.sprintQualifyingPoints,
                    sprint: scoreData.sprintPoints,
                    fl: scoreData.fastestLapPoints
                }
            };
        });

        processed.sort((a, b) => b.points - a.points);
        processed.forEach((u, i) => u.rank = i + 1);

        setProcessedUsers(processed);
        setIsLoading(false);
    };
    loadData();
  }, [raceResults, pointsSystem, allDrivers]);


  if (isLoading) {
      return (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-highlight-silver">
              <TrendingUpIcon className="w-12 h-12 text-primary-red animate-bounce mb-4" />
              <p>Crunching the numbers...</p>
          </div>
      );
  }

  if (view === 'menu') {
      return (
          <div className="max-w-7xl mx-auto animate-fade-in pt-4">
              <h1 className="text-3xl md:text-4xl font-bold text-center text-pure-white mb-2">Leaderboard Hub</h1>
              <p className="text-center text-highlight-silver mb-8 md:mb-12">Analyze league performance and trends.</p>
              
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
      <div className="max-w-7xl mx-auto">
          <div className="mb-4 md:mb-6 flex items-center">
              <button 
                onClick={() => setView('menu')}
                className="flex items-center gap-2 text-highlight-silver hover:text-primary-red transition-colors font-bold py-2"
              >
                  <BackIcon className="w-5 h-5" />
                  Back to Hub
              </button>
          </div>

          {view === 'standings' && <StandingsView users={processedUsers} currentUser={currentUser} />}
          {view === 'popular' && <PopularityView allPicks={allPicks} allDrivers={allDrivers} allConstructors={allConstructors} />}
          {view === 'insights' && <InsightsView users={processedUsers} />}
          {view === 'entities' && <EntityStatsView raceResults={raceResults} pointsSystem={pointsSystem} allDrivers={allDrivers} allConstructors={allConstructors} />}
      </div>
  );
};

export default LeaderboardPage;
