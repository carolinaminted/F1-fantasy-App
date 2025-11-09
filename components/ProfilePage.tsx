// Fix: Implement the ProfilePage component to display user data and usage stats.
import React from 'react';
import { User } from '../types';
import useFantasyData from '../hooks/useFantasyData';
import { MOCK_USER_USAGE } from '../constants';

interface ProfilePageProps {
  user: User;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ user }) => {
  const { aTeams, bTeams, aDrivers, bDrivers } = useFantasyData();
  const allEntities = [...aTeams, ...bTeams, ...aDrivers, ...bDrivers];

  return (
    <div className="max-w-4xl mx-auto text-white">
      <h1 className="text-4xl font-bold mb-8">Team Principal Profile</h1>
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-white/10">
        <h2 className="text-2xl font-semibold">{user.displayName}</h2>
        <p className="text-gray-400">{user.id}</p>
      </div>

      <div className="mt-8">
        <h3 className="text-2xl font-bold mb-4">Season Usage Stats</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-white/10">
            <h4 className="text-xl font-semibold mb-3 text-[#ff8400]">Team Usage</h4>
            <ul className="space-y-2">
              {Object.entries(MOCK_USER_USAGE.teams).map(([id, count]) => {
                const team = allEntities.find(e => e.id === id);
                return (
                  <li key={id} className="flex justify-between items-center text-gray-300">
                    <span>{team?.name || id}</span>
                    <span className="font-mono bg-gray-700/50 px-2 py-1 rounded">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-white/10">
            <h4 className="text-xl font-semibold mb-3 text-[#94d600]">Driver Usage</h4>
            <ul className="space-y-2">
              {Object.entries(MOCK_USER_USAGE.drivers).map(([id, count]) => {
                const driver = allEntities.find(e => e.id === id);
                return (
                  <li key={id} className="flex justify-between items-center text-gray-300">
                    <span>{driver?.name || id}</span>
                    <span className="font-mono bg-gray-700/50 px-2 py-1 rounded">{count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
