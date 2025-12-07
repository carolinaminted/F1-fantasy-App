import React from 'react';
import { Page } from '../App.tsx';
import { User } from '../types.ts';
import { PicksIcon } from './icons/PicksIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { DonationIcon } from './icons/DonationIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';

interface DashboardProps {
  user: User | null;
  setActivePage: (page: Page) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, setActivePage }) => {
  const isAdmin = user?.email === 'admin@fantasy.f1';

  return (
    <div className="max-w-4xl mx-auto pt-8">
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
        <NavTile
          icon={PicksIcon}
          title="Picks"
          description="Submit or edit picks for any active grand prix"
          onClick={() => setActivePage('picks')}
        />
        <NavTile
          icon={LeaderboardIcon}
          title="Leaderboard"
          description="View league wide standings with visuals and metrics"
          onClick={() => setActivePage('leaderboard')}
        />
        <NavTile
          icon={ProfileIcon}
          title="Profile"
          description="View your information, picks, and scoring breakdowns"
          onClick={() => setActivePage('profile')}
        />
        <NavTile
          icon={CheckeredFlagIcon}
          title="Results"
          description="Browse official results for all race weekends"
          onClick={() => setActivePage('gp-results')}
        />
        <NavTile
          icon={TrophyIcon}
          title="Scoring"
          description="Learn how fantasy points are calculated"
          onClick={() => setActivePage('points')}
        />
        {(!user || user.duesPaidStatus !== 'Paid') && (
          <NavTile
            icon={DuesIcon}
            title="Pay Dues"
            description="Pay your league dues for the current season"
            onClick={() => setActivePage('duesPayment')}
          />
        )}
        <NavTile
          icon={DonationIcon}
          title="Donate"
          description="Donate to Victory Junction to support campers"
          onClick={() => setActivePage('donate')}
        />
        {isAdmin && (
          <NavTile
            icon={AdminIcon}
            title="Admin"
            description="Manage GP forms, update race results, manage users, and etc"
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
      aria-label={`${title}: ${description}`}
      className="group rounded-xl p-4 md:p-6 text-center transition-all duration-300 transform hover:-translate-y-1 flex flex-col items-center justify-center aspect-square focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-carbon-black focus:ring-primary-red"
    >
      <Icon className="w-16 h-16 md:w-20 md:h-20 text-primary-red transition-colors duration-300 mb-3" />
      <h3 className="text-xl md:text-2xl font-bold text-ghost-white group-hover:text-primary-red transition-colors duration-300">{title}</h3>
    </button>
  );
};

export default Dashboard;