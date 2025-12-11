
import React, { useEffect, useState, useMemo } from 'react';
import { Page } from '../App.tsx';
import { User, RaceResults, PointsSystem, Driver, Constructor } from '../types.ts';
import { PicksIcon } from './icons/PicksIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { DonationIcon } from './icons/DonationIcon.tsx';
import { DuesIcon } from './icons/DuesIcon.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { getAllUsersAndPicks } from '../services/firestoreService.ts';
import { calculateScoreRollup } from '../services/scoringService.ts';

interface DashboardProps {
  user: User | null;
  setActivePage: (page: Page) => void;
  raceResults?: RaceResults;
  pointsSystem?: PointsSystem;
  allDrivers?: Driver[];
  allConstructors?: Constructor[];
}

const Dashboard: React.FC<DashboardProps> = ({ 
    user, 
    setActivePage,
    raceResults = {}, 
    pointsSystem, 
    allDrivers = [], 
    allConstructors = [] // kept for future use or prop consistency
}) => {
  const isAdmin = user && (!!user.isAdmin || user.email === 'admin@fantasy.f1');
  const [rankData, setRankData] = useState<{ rank: number | string, points: number }>({ rank: '-', points: 0 });
  
  useEffect(() => {
    if (!user || !pointsSystem || allDrivers.length === 0) return;

    const fetchRank = async () => {
        try {
            const { users, allPicks } = await getAllUsersAndPicks();
            
            // Filter out admin from ranking logic to match Leaderboard
            const validUsers = users.filter(u => u.email !== 'admin@fantasy.f1');
            
            const scores = validUsers.map(u => {
                const userPicks = allPicks[u.id] || {};
                const scoreData = calculateScoreRollup(userPicks, raceResults, pointsSystem, allDrivers);
                return { uid: u.id, points: scoreData.totalPoints };
            });

            // Sort descending
            scores.sort((a, b) => b.points - a.points);

            const myRankIndex = scores.findIndex(s => s.uid === user.id);
            const myScore = scores.find(s => s.uid === user.id)?.points || 0;

            if (myRankIndex !== -1) {
                setRankData({ rank: myRankIndex + 1, points: myScore });
            } else {
                // Should not happen if user is valid, but fallback
                 setRankData({ rank: '-', points: myScore });
            }

        } catch (error) {
            console.error("Error calculating dashboard rank:", error);
        }
    };

    fetchRank();
  }, [user, raceResults, pointsSystem, allDrivers]);

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto overflow-hidden">
      
      {/* Header Section */}
      <div className="flex-shrink-0 pt-2 pb-4 px-2 md:pt-8 md:pb-8 text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-pure-white mb-1">Home</h1>
          {user ? (
            <div className="flex flex-col md:flex-row md:items-center md:justify-center gap-1 md:gap-4">
                <p className="text-lg md:text-2xl text-highlight-silver">
                    <span className="text-pure-white font-semibold">{user.displayName}</span>
                </p>
                <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-accent-gray"></div>
                <p className="text-sm md:text-xl font-mono text-primary-red font-bold uppercase tracking-wider">
                    Season Rank: <span className="text-pure-white">#{rankData.rank}</span> <span className="text-highlight-silver text-xs">({rankData.points} PTS)</span>
                </p>
            </div>
          ) : (
             <p className="text-lg text-highlight-silver">Welcome to Formula Fantasy One</p>
          )}
      </div>

      {/* Grid Section - Flex grow to fill space, center vertically if space permits */}
      <div className="flex-1 flex flex-col justify-center min-h-0 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 overflow-y-auto md:overflow-visible custom-scrollbar p-2">
            <NavTile
            icon={PicksIcon}
            title="Picks"
            description="Submit or edit picks"
            onClick={() => setActivePage('picks')}
            />
            <NavTile
            icon={LeaderboardIcon}
            title="Standings"
            description="League standings"
            onClick={() => setActivePage('leaderboard')}
            />
            <NavTile
            icon={ProfileIcon}
            title="Profile"
            description="Your details & scores"
            onClick={() => setActivePage('profile')}
            />
            <NavTile
            icon={TrackIcon}
            title="Results"
            description="Official Race Results"
            onClick={() => setActivePage('gp-results')}
            />
            <NavTile
            icon={TrophyIcon}
            title="Scoring"
            description="Rules & Point System"
            onClick={() => setActivePage('points')}
            />
            {(!user || user.duesPaidStatus !== 'Paid') && (
            <NavTile
                icon={DuesIcon}
                title="Pay Dues"
                description="Settle league dues"
                onClick={() => setActivePage('duesPayment')}
            />
            )}
            <NavTile
            icon={DonationIcon}
            title="Donate"
            description="Support Victory Junction"
            onClick={() => setActivePage('donate')}
            />
            {isAdmin && (
            <NavTile
                icon={AdminIcon}
                title="Admin"
                description="Manage league settings"
                onClick={() => setActivePage('admin')}
            />
            )}
        </div>
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
      className="group bg-accent-gray/30 backdrop-blur-sm rounded-xl p-2 md:p-6 text-center transition-all duration-300 transform hover:-translate-y-1 flex flex-col items-center justify-center h-24 md:h-auto md:aspect-square ring-1 ring-pure-white/5 hover:ring-primary-red focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-carbon-black focus:ring-primary-red active:scale-95"
    >
      <Icon className="w-8 h-8 md:w-20 md:h-20 text-primary-red transition-colors duration-300 mb-1 md:mb-3" />
      <h3 className="text-sm md:text-2xl font-bold text-ghost-white group-hover:text-primary-red transition-colors duration-300 leading-tight">{title}</h3>
      <p className="text-xs text-highlight-silver mt-1 hidden md:block">{description}</p>
    </button>
  );
};

export default Dashboard;
