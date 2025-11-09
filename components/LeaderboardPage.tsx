// Fix: Implement the LeaderboardPage component with mock data.
import React from 'react';

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'Awesome Racing', points: 1250 },
  { rank: 2, name: 'Velocity Vipers', points: 1210 },
  { rank: 3, name: 'Circuit Breakers', points: 1185 },
  { rank: 4, name: 'Apex Predators', points: 1150 },
  { rank: 5, name: 'Team Principal', points: 1120 },
  { rank: 6, name: 'Grid Masters', points: 1095 },
  { rank: 7, name: 'Phoenix Racing', points: 1050 },
  { rank: 8, name: 'Quantum Leap F1', points: 1011 },
  { rank: 9, 'name': 'Eclipse GP', points: 987 },
  { rank: 10, 'name': 'Momentum Motors', points: 950 },
];

const LeaderboardPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto text-white">
      <h1 className="text-4xl font-bold mb-8 text-center">Season Leaderboard</h1>
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg ring-1 ring-white/10 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="p-4 text-sm font-semibold uppercase text-gray-400">Rank</th>
              <th className="p-4 text-sm font-semibold uppercase text-gray-400">Team Name</th>
              <th className="p-4 text-sm font-semibold uppercase text-gray-400 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_LEADERBOARD.map((entry, index) => (
              <tr 
                key={index} 
                className={`border-t border-gray-700/50 ${entry.name === 'Team Principal' ? 'bg-[#ff8400]/20' : ''}`}
              >
                <td className="p-4 font-bold text-lg w-16 text-center">{entry.rank}</td>
                <td className="p-4 font-semibold">{entry.name}</td>
                <td className="p-4 font-bold text-lg text-right">{entry.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaderboardPage;