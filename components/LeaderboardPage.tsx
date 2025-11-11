import React, { useMemo, useState, useEffect } from 'react';
import { CONSTRUCTORS, DRIVERS } from '../constants.ts';
import { calculateScoreRollup } from '../services/scoringService.ts';
import { User, RaceResults, PickSelection } from '../types.ts';
import { getAllUsersAndPicks } from '../services/firestoreService.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';

interface BarChartData {
  label: string;
  value: number;
  isCurrentUser: boolean;
}

interface BarChartProps {
  data: BarChartData[];
}

const BarChart: React.FC<BarChartProps> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.value), 0);
  
  return (
    <div className="space-y-3 p-4 bg-carbon-black/50 rounded-lg">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-4 text-sm">
          <div className="w-28 text-right font-semibold text-ghost-white truncate">{item.label}</div>
          <div className="flex-1 bg-accent-gray/50 rounded-full h-6">
            <div
              className={`h-6 rounded-full flex items-center justify-end px-2 ${item.isCurrentUser ? 'bg-pure-white' : 'bg-primary-red'}`}
              style={{ width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`, minWidth: '2rem' }}
            >
              <span className={`font-bold text-xs ${item.isCurrentUser ? 'text-carbon-black' : 'text-pure-white'}`}>{item.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

interface LeaderboardPageProps {
  currentUser: User | null;
  raceResults: RaceResults;
}

const LeaderboardPage: React.FC<LeaderboardPageProps> = ({currentUser, raceResults}) => {
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [leagueUsageData, setLeagueUsageData] = useState<{ mostUsedTeams: any[], mostUsedDrivers: any[], mostUsedFastestLaps: any[] }>({ mostUsedTeams: [], mostUsedDrivers: [], mostUsedFastestLaps: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [isStandingsExpanded, setIsStandingsExpanded] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isTop5Expanded, setIsTop5Expanded] = useState(true);
  const [isTeamsExpanded, setIsTeamsExpanded] = useState(false);
  const [isDriversExpanded, setIsDriversExpanded] = useState(false);
  const [isFastestLapExpanded, setIsFastestLapExpanded] = useState(false);
  const [isBottom5Expanded, setIsBottom5Expanded] = useState(false);

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      setIsLoading(true);
      const { users, allPicks } = await getAllUsersAndPicks();
      
      const scoredUsers = users.map((user) => {
        const userPicks = allPicks[user.id] || {};
        const { totalPoints } = calculateScoreRollup(userPicks, raceResults);
        return {
          ...user,
          points: totalPoints,
          rank: 0 // placeholder
        };
      })
      .sort((a, b) => b.points - a.points)
      .map((user, index) => ({ ...user, rank: index + 1 }));

      setLeaderboardData(scoredUsers);

      // Calculate league usage
      const teamUsage: { [id: string]: number } = {};
      const driverUsage: { [id: string]: number } = {};
      const fastestLapUsage: { [id: string]: number } = {};
      Object.values(allPicks).forEach(userPicks => {
        Object.values(userPicks).forEach(eventPicks => {
          [...(eventPicks.aTeams || []), eventPicks.bTeam].forEach(id => {
            if (id) teamUsage[id] = (teamUsage[id] || 0) + 1;
          });
          [...(eventPicks.aDrivers || []), ...(eventPicks.bDrivers || [])].forEach(id => {
            if (id) driverUsage[id] = (driverUsage[id] || 0) + 1;
          });
          if (eventPicks.fastestLap) {
            fastestLapUsage[eventPicks.fastestLap] = (fastestLapUsage[eventPicks.fastestLap] || 0) + 1;
          }
        });
      });

      const mostUsedTeams = Object.entries(teamUsage)
        .map(([id, count]) => ({ id, name: CONSTRUCTORS.find(c => c.id === id)?.name || id, count }))
        .sort((a, b) => b.count - a.count);

      const mostUsedDrivers = Object.entries(driverUsage)
        .map(([id, count]) => ({ id, name: DRIVERS.find(d => d.id === id)?.name || id, count }))
        .sort((a, b) => b.count - a.count);

      const mostUsedFastestLaps = Object.entries(fastestLapUsage)
        .map(([id, count]) => ({ id, name: DRIVERS.find(d => d.id === id)?.name || id, count }))
        .sort((a, b) => b.count - a.count);
      
      setLeagueUsageData({ mostUsedTeams, mostUsedDrivers, mostUsedFastestLaps });

      setIsLoading(false);
    };

    fetchLeaderboardData();
  }, [raceResults]);

  const sortedLeaderboardData = useMemo(() => {
    const dataToSort = [...leaderboardData];
    dataToSort.sort((a, b) => {
        if (sortOrder === 'desc') {
            return b.points - a.points;
        } else {
            return a.points - b.points;
        }
    });
    // Re-rank after sorting
    return dataToSort.map((user, index) => ({ ...user, rank: index + 1 }));
  }, [leaderboardData, sortOrder]);

  const handleSortToggle = () => {
    setSortOrder(current => (current === 'desc' ? 'asc' : 'desc'));
  };

  const top5 = useMemo(() => leaderboardData.slice(0, 5).map(u => ({
    label: u.displayName,
    value: u.points,
    isCurrentUser: u.id === currentUser?.id,
  })), [leaderboardData, currentUser]);

  const bottom5 = useMemo(() => leaderboardData.slice(-5).reverse().map(u => ({
    label: u.displayName,
    value: u.points,
    isCurrentUser: u.id === currentUser?.id,
  })), [leaderboardData, currentUser]);


  const UsageList: React.FC<{ items: { name: string; count: number }[] }> = ({ items }) => (
    <ul className="space-y-2">
      {items.slice(0,10).map((item, index) => (
        <li key={index} className="flex justify-between items-center text-ghost-white bg-carbon-black/30 p-2 rounded">
          <span>{item.name}</span>
          <span className="font-mono bg-carbon-black/50 px-2 py-1 rounded">{item.count} picks</span>
        </li>
      ))}
    </ul>
  );
  
  if (isLoading) {
    return <div className="text-center text-xl font-semibold">Loading Leaderboard...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto text-pure-white">
        <h1 className="text-4xl font-bold text-center mb-12">Season Leaderboard</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-x-12 gap-y-12">
            
            {/* Main Content: Full Standings */}
            <div className="lg:col-span-3">
                <div className="lg:hidden mb-4">
                    <button
                        onClick={() => setIsStandingsExpanded(!isStandingsExpanded)}
                        className="w-full flex justify-between items-center p-2 rounded-md hover:bg-accent-gray/50"
                        aria-expanded={isStandingsExpanded}
                        aria-controls="full-standings-table"
                    >
                        <span className="w-8 h-8"></span>{/* Spacer for centering */}
                        <h3 className="text-2xl font-bold text-primary-red">Full Standings</h3>
                        <ChevronDownIcon className={`w-8 h-8 transition-transform ${isStandingsExpanded ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                
                <h3 className="hidden lg:block text-2xl font-bold mb-4 text-primary-red text-center">Full Standings</h3>
                
                <div id="full-standings-table" className={`bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden ${!isStandingsExpanded ? 'hidden' : ''} lg:block`}>
                    <table className="w-full text-left">
                        <thead className="bg-carbon-black/50">
                            <tr>
                                <th className="p-4 text-sm font-semibold uppercase text-highlight-silver">Rank</th>
                                <th className="p-4 text-sm font-semibold uppercase text-highlight-silver">Team Name</th>
                                <th className="p-4 text-sm font-semibold uppercase text-highlight-silver text-right">
                                    <button onClick={handleSortToggle} className="flex items-center justify-end gap-1 w-full font-semibold uppercase">
                                        Points
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
                                    </button>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedLeaderboardData.map(entry => (
                                <tr 
                                    key={entry.id} 
                                    className={`border-t border-accent-gray/50 ${entry.id === currentUser?.id ? 'bg-primary-red/20' : ''}`}
                                >
                                    <td className="p-4 font-bold text-lg w-16 text-center">{entry.rank}</td>
                                    <td className="p-4 font-semibold">{entry.displayName}</td>
                                    <td className="p-4 font-bold text-lg text-right">{entry.points}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Sidebar: Top 5 & Stats */}
            <div className="lg:col-span-2 space-y-12">
                <div>
                    <button
                        onClick={() => setIsTop5Expanded(!isTop5Expanded)}
                        className="w-full flex justify-between items-center"
                        aria-expanded={isTop5Expanded}
                    >
                        <span className="w-6 h-6"></span> {/* Spacer for centering */}
                        <span className="text-xl font-semibold text-primary-red">Top 5 Principals</span>
                        <ChevronDownIcon className={`w-6 h-6 text-highlight-silver transition-transform ${isTop5Expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isTop5Expanded && (
                        <div className="mt-4">
                            <BarChart data={top5} />
                        </div>
                    )}
                </div>
                
                <div>
                    <button
                        onClick={() => setIsBottom5Expanded(!isBottom5Expanded)}
                        className="w-full flex justify-between items-center"
                        aria-expanded={isBottom5Expanded}
                    >
                        <span className="w-6 h-6"></span> {/* Spacer for centering */}
                        <span className="text-xl font-semibold text-primary-red">Bottom 5 Principals</span>
                        <ChevronDownIcon className={`w-6 h-6 text-highlight-silver transition-transform ${isBottom5Expanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isBottom5Expanded && (
                        <div className="mt-4">
                            <BarChart data={bottom5} />
                        </div>
                    )}
                </div>
                
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-8">
                        <div>
                            <button
                                onClick={() => setIsTeamsExpanded(!isTeamsExpanded)}
                                className="w-full flex justify-between items-center"
                                aria-expanded={isTeamsExpanded}
                            >
                                <span className="w-6 h-6"></span> {/* Spacer for centering */}
                                <span className="text-xl font-semibold text-primary-red">Popular Team Picks</span>
                                <ChevronDownIcon className={`w-6 h-6 text-highlight-silver transition-transform ${isTeamsExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isTeamsExpanded && (
                                <div className="mt-4">
                                    <UsageList items={leagueUsageData.mostUsedTeams} />
                                </div>
                            )}
                        </div>
                        <div>
                            <button
                                onClick={() => setIsDriversExpanded(!isDriversExpanded)}
                                className="w-full flex justify-between items-center"
                                aria-expanded={isDriversExpanded}
                            >
                                <span className="w-6 h-6"></span> {/* Spacer for centering */}
                                <span className="text-xl font-semibold text-primary-red">Popular Driver Picks</span>
                                <ChevronDownIcon className={`w-6 h-6 text-highlight-silver transition-transform ${isDriversExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isDriversExpanded && (
                                <div className="mt-4">
                                    <UsageList items={leagueUsageData.mostUsedDrivers} />
                                </div>
                            )}
                        </div>
                         <div>
                            <button
                                onClick={() => setIsFastestLapExpanded(!isFastestLapExpanded)}
                                className="w-full flex justify-between items-center"
                                aria-expanded={isFastestLapExpanded}
                            >
                                <span className="w-6 h-6"></span> {/* Spacer for centering */}
                                <span className="text-xl font-semibold text-primary-red">Popular Fastest Lap Picks</span>
                                <ChevronDownIcon className={`w-6 h-6 text-highlight-silver transition-transform ${isFastestLapExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isFastestLapExpanded && (
                                <div className="mt-4">
                                    <UsageList items={leagueUsageData.mostUsedFastestLaps} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default LeaderboardPage;