import React, { useMemo } from 'react';
import { MOCK_USERS, MOCK_SEASON_PICKS, CONSTRUCTORS, DRIVERS } from '../constants';
import { calculateScoreRollup } from '../hooks/useFantasyData';
import { User, RaceResults } from '../types';

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
  
  const leaderboardData = useMemo(() => {
    return MOCK_USERS.map((user) => {
      const userPicks = MOCK_SEASON_PICKS[user.id] || {};
      const { totalPoints } = calculateScoreRollup(userPicks, raceResults);
      return {
        ...user,
        points: totalPoints,
        rank: 0 // placeholder
      };
    })
    .sort((a, b) => b.points - a.points)
    .map((user, index) => ({ ...user, rank: index + 1 }));
  }, [raceResults]);

  const leagueUsageData = useMemo(() => {
    const teamUsage: { [id: string]: number } = {};
    const driverUsage: { [id: string]: number } = {};

    Object.values(MOCK_SEASON_PICKS).forEach(userPicks => {
      Object.values(userPicks).forEach(eventPicks => {
        [...eventPicks.aTeams, eventPicks.bTeam].forEach(id => {
          if (id) teamUsage[id] = (teamUsage[id] || 0) + 1;
        });
        [...eventPicks.aDrivers, ...eventPicks.bDrivers].forEach(id => {
          if (id) driverUsage[id] = (driverUsage[id] || 0) + 1;
        });
      });
    });

    const mostUsedTeams = Object.entries(teamUsage)
      .map(([id, count]) => ({ id, name: CONSTRUCTORS.find(c => c.id === id)?.name || id, count }))
      .sort((a, b) => b.count - a.count);

    const mostUsedDrivers = Object.entries(driverUsage)
      .map(([id, count]) => ({ id, name: DRIVERS.find(d => d.id === id)?.name || id, count }))
      .sort((a, b) => b.count - a.count);

    return { mostUsedTeams, mostUsedDrivers };
  }, []);

  const top5 = leaderboardData.slice(0, 5).map(u => ({
    label: u.displayName,
    value: u.points,
    isCurrentUser: u.id === currentUser?.id,
  }));

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

  return (
    <div className="max-w-4xl mx-auto text-pure-white space-y-12">
      <h1 className="text-4xl font-bold text-center">Season Leaderboard</h1>

      <div>
        <h3 className="text-2xl font-bold mb-4 text-center">Top 5 Principals</h3>
        <BarChart data={top5} />
      </div>

      <div>
        <h3 className="text-2xl font-bold mb-4 text-center">Full Standings</h3>
        <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-carbon-black/50">
              <tr>
                <th className="p-4 text-sm font-semibold uppercase text-highlight-silver">Rank</th>
                <th className="p-4 text-sm font-semibold uppercase text-highlight-silver">Team Name</th>
                <th className="p-4 text-sm font-semibold uppercase text-highlight-silver text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map(entry => (
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
      
      <div>
        <h3 className="text-2xl font-bold mb-4 text-center">League Usage Stats</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
                <h4 className="text-xl font-semibold mb-4 text-primary-red text-center">Most Used Teams</h4>
                <UsageList items={leagueUsageData.mostUsedTeams} />
            </div>
            <div>
                <h4 className="text-xl font-semibold mb-4 text-primary-red text-center">Most Used Drivers</h4>
                <UsageList items={leagueUsageData.mostUsedDrivers} />
            </div>
        </div>
      </div>

    </div>
  );
};

export default LeaderboardPage;