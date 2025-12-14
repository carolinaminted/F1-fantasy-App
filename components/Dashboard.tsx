
import React, { useEffect, useState, useRef } from 'react';
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
import { F1CarIcon } from './icons/F1CarIcon.tsx';
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

// Helper for scroll animations
const FadeInSection: React.FC<{ children: React.ReactNode; delay?: string; className?: string }> = ({ children, delay = '0s', className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => setIsVisible(entry.isIntersecting));
    });
    if (domRef.current) observer.observe(domRef.current);
    return () => {
      if (domRef.current) observer.unobserve(domRef.current);
    };
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
      } ${className}`}
      style={{ transitionDelay: delay }}
    >
      {children}
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ 
    user, 
    setActivePage,
    raceResults = {}, 
    pointsSystem, 
    allDrivers = [], 
}) => {
  const isAdmin = user && !!user.isAdmin;
  const [rankData, setRankData] = useState<{ rank: number | string, points: number }>({ rank: '-', points: 0 });
  
  useEffect(() => {
    // If user already has pre-calculated rank/points, use them directly
    if (user?.totalPoints !== undefined && user?.rank !== undefined) {
        setRankData({
            rank: user.rank,
            points: user.totalPoints
        });
        return;
    }

    if (!user || !pointsSystem || allDrivers.length === 0) return;

    // Fallback: Client-side calculation if cloud data missing
    const fetchRank = async () => {
        try {
            const { users, allPicks } = await getAllUsersAndPicks();
            // Filter out Admin Principal as fallback/safety for display if needed
            const validUsers = users.filter(u => u.displayName !== 'Admin Principal');
            
            const scores = validUsers.map(u => {
                // If user has pre-calc points, use them
                if (u.totalPoints !== undefined) {
                    return { uid: u.id, points: u.totalPoints };
                }
                // Else calculate
                const userPicks = allPicks[u.id] || {};
                const scoreData = calculateScoreRollup(userPicks, raceResults, pointsSystem, allDrivers);
                return { uid: u.id, points: scoreData.totalPoints };
            });

            scores.sort((a, b) => b.points - a.points);
            const myRankIndex = scores.findIndex(s => s.uid === user.id);
            const myScore = scores.find(s => s.uid === user.id)?.points || 0;

            setRankData({ 
                rank: myRankIndex !== -1 ? myRankIndex + 1 : '-', 
                points: myScore 
            });

        } catch (error) {
            console.error("Error calculating dashboard rank:", error);
        }
    };

    fetchRank();
  }, [user, raceResults, pointsSystem, allDrivers]);

  return (
    <div className="flex flex-col w-full min-h-screen pb-20">
      
      {/* 1. HERO SECTION - Full Screen for Immersive Feel */}
      <div className="relative w-full h-[90vh] md:h-screen flex items-center justify-center overflow-hidden">
         {/* Background Image with Parallax-like feel */}
         <div 
            className="absolute inset-0 bg-cover bg-center z-0" 
            style={{ 
                backgroundImage: `url('https://media.formula1.com/image/upload/f_auto,c_limit,w_1440,q_auto/f_auto/q_auto/content/dam/fom-website/manual/Misc/2021-Master-Folder/F1%202021%20Generic/F1%202021%20Generic%20(5)')`,
                filter: 'brightness(0.5) contrast(1.1)'
            }}
         ></div>
         <div className="absolute inset-0 bg-gradient-to-t from-carbon-black via-carbon-black/50 to-transparent z-10"></div>
         
         {/* Hero Content - Centered */}
         <div className="relative z-20 text-center px-4 pb-20">
            {/* Animated Title Block - Drives Up */}
            <div className="animate-drive-in opacity-0">
                <F1CarIcon className="w-16 h-16 text-primary-red mx-auto mb-4 drop-shadow-[0_0_15px_rgba(218,41,28,0.5)]" />
                <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-pure-white mb-2">
                    FORMULA<br/>FANTASY ONE
                </h1>
            </div>

            {/* Animated Principal Card - Drafts behind title with delay */}
            {user ? (
                <div className="mt-6 inline-flex flex-col items-center bg-carbon-black/60 backdrop-blur-md border border-pure-white/10 rounded-2xl p-6 shadow-2xl transform transition-transform hover:scale-105 duration-500 animate-drive-in opacity-0 [animation-delay:200ms]">
                    <p className="text-highlight-silver text-sm uppercase tracking-widest font-bold mb-1">Team Principal</p>
                    <p className="text-2xl font-bold text-pure-white mb-3">{user.displayName}</p>
                    <div className="flex items-center gap-6 border-t border-pure-white/10 pt-3">
                        <div className="text-center">
                            <span className="block text-2xl font-black text-primary-red">#{rankData.rank}</span>
                            <span className="text-[10px] text-highlight-silver uppercase">Global Rank</span>
                        </div>
                        <div className="w-px h-8 bg-pure-white/10"></div>
                        <div className="text-center">
                            <span className="block text-2xl font-black text-pure-white">{rankData.points}</span>
                            <span className="text-[10px] text-highlight-silver uppercase">Points</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="animate-drive-in opacity-0 [animation-delay:200ms]">
                    <button 
                        className="mt-6 bg-primary-red text-pure-white font-bold py-3 px-8 rounded-full shadow-lg hover:scale-105 transition-transform"
                    >
                        Start Your Engine
                    </button>
                </div>
            )}
         </div>
      </div>

      {/* 2. CORE ACTION SECTIONS - Overlap (-mt-24) creates the peeking effect */}
      <div className="max-w-5xl mx-auto w-full px-4 -mt-24 relative z-30 flex flex-col gap-4 md:gap-8">
        
        {/* Main Cards Grid: Side-by-side on Desktop for better density */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {/* Picks Section - The 'Peeking' Tile - Custom Animation to rise from bottom */}
            <div 
                onClick={() => setActivePage('picks')}
                className="group relative overflow-hidden bg-accent-gray/80 backdrop-blur-md rounded-2xl p-6 md:p-10 border border-pure-white/5 shadow-2xl cursor-pointer hover:border-primary-red/5 transition-all duration-300 transform hover:-translate-y-1 animate-peek-up opacity-0 [animation-delay:400ms]"
            >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <PicksIcon className="w-48 h-48 text-primary-red" />
                </div>
                <div className="relative z-10">
                    <div className="w-12 h-12 bg-primary-red/20 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(218,41,28,0.3)]">
                        <PicksIcon className="w-6 h-6 text-primary-red" />
                    </div>
                    <h2 className="text-3xl font-bold text-pure-white mb-2 group-hover:text-primary-red transition-colors">Race Strategy</h2>
                    <p className="text-highlight-silver max-w-md text-lg leading-relaxed">
                        Make your team and driver selections for the upcoming Grand Prix.
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-pure-white font-bold text-sm uppercase tracking-wider">
                        Manage Picks <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                </div>
            </div>

            {/* Standings Section - Standard Fade In on Scroll */}
            <FadeInSection delay="0.2s" className="h-full">
                <div 
                    onClick={() => setActivePage('leaderboard')}
                    className="group relative overflow-hidden bg-carbon-black/80 backdrop-blur-md rounded-2xl p-6 md:p-10 border border-pure-white/5 shadow-xl cursor-pointer hover:border-pure-white/30 transition-all duration-300 h-full flex flex-col justify-center"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:-rotate-12 duration-500">
                        <LeaderboardIcon className="w-48 h-48 text-pure-white" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="w-12 h-12 bg-pure-white/10 rounded-xl flex items-center justify-center mb-4">
                                <LeaderboardIcon className="w-6 h-6 text-pure-white" />
                            </div>
                            <h2 className="text-3xl font-bold text-pure-white mb-2">Leaderboard</h2>
                            <p className="text-highlight-silver max-w-sm text-lg leading-relaxed">
                                Track the championship battle.
                            </p>
                        </div>
                        <div className="bg-accent-gray/50 rounded-xl p-4 min-w-[120px] text-center border border-pure-white/5">
                            <p className="text-xs text-highlight-silver uppercase tracking-wider mb-1">Your Rank</p>
                            <p className="text-4xl font-black text-primary-red">#{rankData.rank}</p>
                        </div>
                    </div>
                </div>
            </FadeInSection>
        </div>

        {/* 3. UTILITY GRID - Peeks up on Desktop due to reduced hero height and grid layout above */}
        <FadeInSection delay="0.3s">
            <h3 className="text-highlight-silver text-xs font-bold uppercase tracking-widest mb-4 ml-1">Team Operations</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <QuickAction 
                    icon={ProfileIcon} 
                    label="Profile" 
                    sub="History & Stats" 
                    onClick={() => setActivePage('profile')} 
                />
                <QuickAction 
                    icon={TrackIcon} 
                    label="Results" 
                    sub="Official Classification" 
                    onClick={() => setActivePage('gp-results')} 
                />
                <QuickAction 
                    icon={TrophyIcon} 
                    label="Scoring" 
                    sub="Rules & Points" 
                    onClick={() => setActivePage('points')} 
                />
                 {(!user || user.duesPaidStatus !== 'Paid') && (
                    <QuickAction 
                        icon={DuesIcon} 
                        label="Pay Dues" 
                        sub="Unlock Season"
                        highlight 
                        onClick={() => setActivePage('duesPayment')} 
                    />
                )}
                <QuickAction 
                    icon={DonationIcon} 
                    label="Donate" 
                    sub="Victory Junction" 
                    onClick={() => setActivePage('donate')} 
                />
                {isAdmin && (
                    <QuickAction 
                        icon={AdminIcon} 
                        label="Admin" 
                        sub="League Controls" 
                        onClick={() => setActivePage('admin')} 
                    />
                )}
            </div>
        </FadeInSection>

      </div>
      
      {/* Footer Branding */}
      <div className="mt-12 text-center opacity-30 pb-safe">
        <F1CarIcon className="w-8 h-8 mx-auto mb-2 text-pure-white" />
        <p className="text-[10px] text-highlight-silver uppercase tracking-widest">Formula Fantasy One © {new Date().getFullYear()}</p>
      </div>

    </div>
  );
};

const QuickAction: React.FC<{ 
    icon: React.FC<React.SVGProps<SVGSVGElement>>; 
    label: string; 
    sub: string;
    onClick: () => void;
    highlight?: boolean;
}> = ({ icon: Icon, label, sub, onClick, highlight }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-start justify-between p-4 h-32 rounded-xl border text-left transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
            highlight 
            ? 'bg-primary-red text-pure-white border-primary-red shadow-lg shadow-primary-red/20'
            : 'bg-accent-gray/30 backdrop-blur-sm border-pure-white/5 hover:bg-accent-gray/50 hover:border-pure-white/20'
        }`}
    >
        <Icon className={`w-8 h-8 ${highlight ? 'text-pure-white' : 'text-primary-red'}`} />
        <div>
            <span className={`block font-bold text-lg leading-none ${highlight ? 'text-pure-white' : 'text-ghost-white'}`}>{label}</span>
            <span className={`text-xs ${highlight ? 'text-white/80' : 'text-highlight-silver'}`}>{sub}</span>
        </div>
    </button>
);

export default Dashboard;
