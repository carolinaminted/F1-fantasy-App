import React from 'react';
import { Page } from '../App.tsx';
import { User } from '../types.ts';
import { PicksIcon } from './icons/PicksIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { DonationIcon } from './icons/DonationIcon.tsx';

interface DashboardProps {
  user: User | null;
  setActivePage: (page: Page) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, setActivePage }) => {
  const isAdmin = user?.email === 'admin@fantasy.f1';

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold text-pure-white mb-8 text-center">Home Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <NavTile
          icon={TrophyIcon}
          title="Points System"
          description="Learn how fantasy points are calculated."
          onClick={() => setActivePage('points')}
        />
        <NavTile
          icon={DonationIcon}
          title="Make a Donation"
          description="Support the league by making a contribution."
          onClick={() => setActivePage('donate')}
        />
        {isAdmin && (
          <NavTile
            icon={AdminIcon}
            title="Admin Panel"
            description="Manage season events and update race results."
            onClick={() => setActivePage('admin')}
          />
        )}
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
      className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 text-left ring-1 ring-pure-white/10 hover:ring-primary-red transition-all duration-300 transform hover:-translate-y-1"
    >
      <Icon className="w-10 h-10 text-primary-red mb-4" />
      <h3 className="text-xl font-bold text-pure-white mb-2">{title}</h3>
      <p className="text-highlight-silver">{description}</p>
    </button>
  );
};

export default Dashboard;