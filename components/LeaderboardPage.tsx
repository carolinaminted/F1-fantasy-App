
import React, { useMemo, useState, useEffect } from 'react';
import { EVENTS } from '../constants.ts';
import { calculateScoreRollup } from '../services/scoringService.ts';
import { User, RaceResults, PickSelection, PointsSystem, Event, Driver, Constructor } from '../types.ts';
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

// --- Shared Types & Helpers ---

type ViewState = 'menu' | 'standings' | 'popular' | 'insights';
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
            {data.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                    <span className="w-32 text-right truncate font-semibold text-highlight-silver">{item.label}</span>
                    <div className="flex-1 h-4 bg-carbon-black rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full ${item.color || 'bg-primary-red'}`} 
                            style={{ width: `${(item.value / maxValue) * 100}%` }} 
                        />
                    </div>
                    <span className="w-12 font-bold text-pure-white">{item.value}</span>
                </div>
            ))}
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

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <h2 className="text-2xl font-bold text-pure-white">League Standings</h2>
                <input
                    type="text"
                    placeholder="Search principals..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full md:w-64 bg-carbon-black/70 border border-accent-gray rounded-md py-2 px-4 text-pure-white focus:ring-primary-red focus:border-primary-red"
                />
            </div>

            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
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
        const driverCounts: { [id: string]: number } = {};

        // Determine relevant events based on "Time Range"
        // 30 days ~= 2-3 races, 60 ~= 4-5, 90 ~= 6-7.
        // We will simply take the LAST N events from the EVENTS list.
        let relevantEvents: Event[] = EVENTS;
        if (timeRange === '30') relevantEvents = EVENTS.slice(0, 3); // Simulating "Recent" (First 3 for demo data since future dates)
        if (timeRange === '60') relevantEvents = EVENTS.slice(0, 5);
        if (timeRange === '90') relevantEvents = EVENTS.slice(0, 8);
        
        const relevantEventIds = new Set(relevantEvents.map(e => e.id));

        Object.values(allPicks).forEach(userPicks => {
            Object.entries(userPicks).forEach(([eventId, picks]) => {
                // Ignore picks that aren't in the current calendar or selected range
                if (!relevantEventIds.has(eventId)) return;

                const teams = [...picks.aTeams, picks.bTeam].filter(Boolean) as string[];
                const drivers = [...picks.aDrivers, picks.bDrivers].filter(Boolean) as string[];

                teams.forEach(t => teamCounts[t] = (teamCounts[t] || 0) + 1);
                drivers.forEach(d => driverCounts[d] = (driverCounts[d] || 0) + 1);
            });
        });

        const sortAndMap = (counts: { [id: string]: number }) => 
            Object.entries(counts)
                .map(([id, val]) => ({ label: getEntityName(id, allDrivers, allConstructors), value: val }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 5);

        return {
            teams: sortAndMap(teamCounts),
            drivers: sortAndMap(driverCounts)
        };
    }, [allPicks, timeRange, allDrivers, allConstructors]);

    return (
        <div className="space-y-8 animate-fade-in">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-pure-white">Popular Picks Analysis</h2>
                <div className="flex bg-accent-gray rounded-lg p-1">
                    {(['all', '30', '60', '90'] as const).map(range => (
                         <button
                            key={range}
                            onClick={() => setTimeRange(range)}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition-colors ${
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
            // Ensure there is actually a score > 0
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

            {/* Top 5 Breakdown Chart */}
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
                <div className="flex gap-4 justify-center mt-4 text-xs text-highlight-silver">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-primary-red rounded-sm"></div> Race</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 rounded-sm"></div> Quali</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded-sm"></div> Sprint</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-purple-500 rounded-sm"></div> FL</div>
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

  // Data Fetching & Processing
  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true);
        const { users, allPicks: picksData } = await getAllUsersAndPicks();
        setAllPicks(picksData);

        const processed = users.map(user => {
            const userPicks = picksData[user.id] || {};
            
            // Use the centralized scoring service logic which handles event filtering automatically
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

        // Sort and Rank
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

  // --- Render Logic ---

  if (view === 'menu') {
      return (
          <div className="max-w-7xl mx-auto animate-fade-in">
              <h1 className="text-4xl font-bold text-center text-pure-white mb-2">Leaderboard Hub</h1>
              <p className="text-center text-highlight-silver mb-12">Analyze league performance and trends.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          <div className="mb-6 flex items-center">
              <button 
                onClick={() => setView('menu')}
                className="flex items-center gap-2 text-highlight-silver hover:text-primary-red transition-colors font-bold"
              >
                  <BackIcon className="w-5 h-5" />
                  Back to Hub
              </button>
          </div>

          {view === 'standings' && <StandingsView users={processedUsers} currentUser={currentUser} />}
          {view === 'popular' && <PopularityView allPicks={allPicks} allDrivers={allDrivers} allConstructors={allConstructors} />}
          {view === 'insights' && <InsightsView users={processedUsers} />}
      </div>
  );
};

export default LeaderboardPage;
