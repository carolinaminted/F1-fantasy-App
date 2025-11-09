// Fix: Display total points and a detailed scoring breakdown on the profile page.
import React from 'react';
import { User, PickSelection, EntityClass, Constructor, Driver } from '../types';
import useFantasyData from '../hooks/useFantasyData';
import { LeaderboardIcon } from './icons/LeaderboardIcon';
import { FastestLapIcon } from './icons/FastestLapIcon';
import { F1CarIcon } from './icons/F1CarIcon';

interface ProfilePageProps {
  user: User;
  seasonPicks: { [eventId: string]: PickSelection };
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user, seasonPicks }) => {
  const { aTeams, bTeams, aDrivers, bDrivers, usageRollup, scoreRollup } = useFantasyData(seasonPicks);

  // Process Team Usage
  const allTeams = [...aTeams, ...bTeams];
  const teamUsageEntries = Object.entries(usageRollup.teams)
    .map(([id, count]) => {
      const team = allTeams.find(t => t.id === id);
      return team ? { ...team, count } : null;
    })
    .filter((t): t is Constructor & { count: number } => t !== null);

  const classATeamUsage = teamUsageEntries
    .filter(t => t.class === EntityClass.A)
    .sort((a, b) => b.count - a.count);

  const classBTeamUsage = teamUsageEntries
    .filter(t => t.class === EntityClass.B)
    .sort((a, b) => b.count - a.count);

  // Process Driver Usage
  const allDrivers = [...aDrivers, ...bDrivers];
  const driverUsageEntries = Object.entries(usageRollup.drivers)
    .map(([id, count]) => {
      const driver = allDrivers.find(d => d.id === id);
      return driver ? { ...driver, count } : null;
    })
    .filter((d): d is Driver & { count: number } => d !== null);

  const classADriverUsage = driverUsageEntries
    .filter(d => d.class === EntityClass.A)
    .sort((a, b) => b.count - a.count);

  const classBDriverUsage = driverUsageEntries
    .filter(d => d.class === EntityClass.B)
    .sort((a, b) => b.count - a.count);

  const UsageList: React.FC<{ items: ({ id: string; name: string; count: number })[] }> = ({ items }) => (
    <ul className="space-y-2">
      {items.map(item => (
        <li key={item.id} className="flex justify-between items-center text-gray-300">
          <span>{item.name}</span>
          <span className="font-mono bg-gray-700/50 px-2 py-1 rounded">{item.count}</span>
        </li>
      ))}
    </ul>
  );

  const ScoreBreakdownItem: React.FC<{ title: string, points: number, icon: React.ReactNode }> = ({ title, points, icon }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg flex items-center gap-4">
      <div className="text-[#ff8400]">{icon}</div>
      <div>
        <p className="text-gray-400 text-sm">{title}</p>
        <p className="text-white font-bold text-xl">{points}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto text-white space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Profile</h1>
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">{user.displayName}</h2>
            <p className="text-gray-400">{user.id}</p>
          </div>
          <div className="text-right">
              <p className="text-gray-400 text-sm uppercase tracking-wider">Season Total</p>
              <p className="text-4xl font-black text-[#ff8400]">{scoreRollup.totalPoints} <span className="text-2xl font-bold text-gray-300">PTS</span></p>
          </div>
        </div>
      </div>
      
      <div>
        <h3 className="text-2xl font-bold mb-4">Scoring Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <ScoreBreakdownItem title="Grand Prix" points={scoreRollup.grandPrixPoints} icon={<F1CarIcon className="w-8 h-8"/>} />
            <ScoreBreakdownItem title="Sprint Race" points={scoreRollup.sprintPoints} icon={<F1CarIcon className="w-8 h-8"/>} />
            <ScoreBreakdownItem title="Fastest Lap" points={scoreRollup.fastestLapPoints} icon={<FastestLapIcon className="w-8 h-8"/>} />
            <ScoreBreakdownItem title="GP Quali" points={scoreRollup.gpQualifyingPoints} icon={<LeaderboardIcon className="w-8 h-8" />} />
            <ScoreBreakdownItem title="Sprint Quali" points={scoreRollup.sprintQualifyingPoints} icon={<LeaderboardIcon className="w-8 h-8" />} />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-bold mb-4">Season Usage Stats</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-white/10">
            <h4 className="text-xl font-semibold mb-3 text-[#ff8400]">Team Usage</h4>
            {teamUsageEntries.length > 0 ? (
              <div className="space-y-4">
                {classATeamUsage.length > 0 && (
                  <div>
                    <h5 className="text-md font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-1">Class A</h5>
                    <UsageList items={classATeamUsage} />
                  </div>
                )}
                {classBTeamUsage.length > 0 && (
                  <div>
                    <h5 className="text-md font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-1">Class B</h5>
                    <UsageList items={classBTeamUsage} />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">No teams have been used this season.</p>
            )}
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-white/10">
            <h4 className="text-xl font-semibold mb-3 text-[#94d600]">Driver Usage</h4>
            {driverUsageEntries.length > 0 ? (
              <div className="space-y-4">
                {classADriverUsage.length > 0 && (
                  <div>
                    <h5 className="text-md font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-1">Class A</h5>
                    <UsageList items={classADriverUsage} />
                  </div>
                )}
                {classBDriverUsage.length > 0 && (
                  <div>
                    <h5 className="text-md font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-1">Class B</h5>
                    <UsageList items={classBDriverUsage} />
                  </div>
                )}
              </div>
            ) : (
               <p className="text-gray-400">No drivers have been used this season.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
