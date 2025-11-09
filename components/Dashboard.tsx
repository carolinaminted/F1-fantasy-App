import React from 'react';
import { Page } from '../App';
import { PicksIcon } from './icons/PicksIcon';
import { LeaderboardIcon } from './icons/LeaderboardIcon';
import { ProfileIcon } from './icons/ProfileIcon';

interface DashboardProps {
  setActivePage: (page: Page) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setActivePage }) => {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 text-center">Home Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <NavTile
          icon={PicksIcon}
          title="Weekly Picks"
          description="Submit or edit your picks for the next event."
          onClick={() => setActivePage('picks')}
        />
        <NavTile
          icon={LeaderboardIcon}
          title="Leaderboard"
          description="View the current league standings and points."
          onClick={() => setActivePage('leaderboard')}
        />
        <NavTile
          icon={ProfileIcon}
          title="My Profile"
          description="Check your season usage stats and history."
          onClick={() => setActivePage('profile')}
        />
      </div>
    </div>
  );
};

interface NavTileProps {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  title: string;
  description: string;
  onClick: () => void;
}

const NavTile: React.FC<NavTileProps> = ({ icon: Icon, title, description, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 text-left ring-1 ring-white/10 hover:ring-[#ff8400] transition-all duration-300 transform hover:-translate-y-1"
    >
      <Icon className="w-10 h-10 text-[#ff8400] mb-4" />
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400">{description}</p>
    </button>
  );
};

export default Dashboard;