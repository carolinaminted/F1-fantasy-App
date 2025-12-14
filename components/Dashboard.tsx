
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Page } from '../App.tsx';
import { User, RaceResults, PointsSystem, Driver, Constructor, Event } from '../types.ts';
import { PicksIcon } from './icons/PicksIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import { DonationIcon } from './icons/DonationIcon.tsx';
import { TrackIcon } from './icons/TrackIcon.tsx';
import { LeagueIcon } from './icons/LeagueIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { getAllUsersAndPicks } from '../services/firestoreService.ts';
import { calculateScoreRollup } from '../services/scoringService.ts';
import CountdownTimer from './CountdownTimer.tsx';

interface DashboardProps {
  user: User | null;
  setActivePage: (page: Page, params?: { eventId?: string }) => void;
  raceResults?: RaceResults;
  pointsSystem?: PointsSystem;
  allDrivers?: Driver[];
  allConstructors?: Constructor[];
  events: Event[];
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
    events 
}) => {
  const isAdmin = user && !!user.isAdmin;
  
  // Find next event for countdown
  const nextEvent = useMemo(() => {
      const now = new Date();
      return events?.find(e => new Date(e.lockAtUtc) > now);
  }, [events]);

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
         <div className="relative z-20 text-center px-4 pb-20 flex flex-col items-center">
            {/* Animated Title Block - Drives Up */}
            <div className="animate-drive-in opacity-0 relative">
                {/* Checkered Flags Reveal - Behind Logo */}
                {/* Added opacity-0 to flag containers to hide them initially until animation delay triggers */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full flex justify-center items-center -z-10 pointer-events-none">
                    <div className="origin-bottom-right animate-flag-left opacity-0">
                        {/* Flip Left Flag to wave outwards (Left) */}
                        <div className="transform scale-x-[-1]">
                            <CheckeredFlagIcon className="w-16 h-16 md:w-32 md:h-32 text-pure-white" />
                        </div>
                    </div>
                    <div className="origin-bottom-left animate-flag-right opacity-0">
                        {/* Normal Right Flag waves outwards (Right) */}
                        <CheckeredFlagIcon className="w-16 h-16 md:w-32 md:h-32 text-pure-white" />
                    </div>
                </div>

                <F1CarIcon className="w-16 h-16 text-primary-red mx-auto mb-4 drop-shadow-[0_0_15px_rgba(218,41,28,0.5)]" />
                <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-pure-white mb-2">
                    FORMULA<br/>FANTASY ONE
                </h1>
            </div>

            {/* Next Race Countdown - Inserted Here */}
            {nextEvent && (
                <div 
                    className="mt-6 animate-drive-in opacity-0 [animation-delay:100ms] w-full max-w-sm cursor-pointer transition-transform hover:scale-105 active:scale-95 group"
                    onClick={() => setActivePage('picks', { eventId: nextEvent.id })}
                >
                    <div className="bg-carbon-black/40 backdrop-blur-md border border-pure-white/10 rounded-xl p-4 shadow-xl group-hover:border-primary-red/50 transition-colors">
                        <p className="text-[10px] text-highlight-silver uppercase tracking-[0.2em] font-bold mb-1">Up Next: {nextEvent.location}</p>
                        <h2 className="text-2xl md:text-3xl font-black text-pure-white italic mb-3">{nextEvent.name}</h2>
                        
                        <div className="border-t border-pure-white/10 pt-3 flex flex-col items-center">
                            <p className="text-[10px] text-primary-red uppercase tracking-wider font-bold mb-2">Picks Lock In</p>
                            <CountdownTimer targetDate={nextEvent.lockAtUtc} />
                        </div>
                    </div>
                </div>
            )}

            {/* Start Engine Button (Only for guests) */}
            {!user && (
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
      <div className="max-w-6xl mx-auto w-full px-4 -mt-24 relative z-30 flex flex-col gap-4 md:gap-8">
        
        {/* Main Cards Grid: Side-by-side on Desktop for better density */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
            {/* Picks Section - CARBON FIBER */}
            <div 
                onClick={() => setActivePage('picks')}
                className="group relative overflow-hidden bg-carbon-fiber rounded-2xl p-6 md:p-10 border border-pure-white/10 shadow-2xl cursor-pointer hover:border-primary-red/50 transition-all duration-300 transform hover:-translate-y-1 animate-peek-up opacity-0 [animation-delay:400ms] min-h-[350px] flex flex-col justify-center"
            >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
                    <PicksIcon className="w-64 h-64 text-primary-red" />
                </div>
                <div className="relative z-10">
                    <div className="w-14 h-14 bg-primary-red/20 rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(218,41,28,0.3)]">
                        <PicksIcon className="w-7 h-7 text-primary-red" />
                    </div>
                    <h2 className="text-4xl font-bold text-pure-white mb-3 group-hover:text-primary-red transition-colors">Race Strategy</h2>
                    <p className="text-highlight-silver max-w-md text-xl leading-relaxed">
                        Make your team and driver selections for the upcoming Grand Prix.
                    </p>
                    <div className="mt-8 flex items-center gap-2 text-pure-white font-bold text-sm uppercase tracking-wider">
                        Manage Picks <span className="group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                </div>
            </div>

            {/* Standings Section - CARBON FIBER with RED ACCENTS */}
            <FadeInSection delay="0.2s" className="h-full">
                <div 
                    onClick={() => setActivePage('leaderboard')}
                    className="group relative overflow-hidden bg-carbon-fiber rounded-2xl p-6 md:p-10 border border-primary-red/30 shadow-xl cursor-pointer hover:border-primary-red hover:shadow-[0_0_20px_rgba(218,41,28,0.2)] transition-all duration-300 h-full flex flex-col justify-center min-h-[350px]"
                >
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:-rotate-12 duration-500">
                        <LeaderboardIcon className="w-64 h-64 text-primary-red" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-14 h-14 bg-primary-red/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
                            <LeaderboardIcon className="w-7 h-7 text-pure-white" />
                        </div>
                        <h2 className="text-4xl font-bold text-pure-white mb-3 group-hover:text-primary-red transition-colors">Leaderboard</h2>
                        <p className="text-highlight-silver max-w-sm text-xl leading-relaxed">
                            Track the championship battle.
                        </p>
                        <div className="mt-8 flex items-center gap-2 text-pure-white font-bold text-sm uppercase tracking-wider">
                            View Leaderboards <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </div>
                    </div>
                </div>
            </FadeInSection>
        </div>

        {/* 3. UTILITY GRID - CARBON FIBER TILES */}
        <FadeInSection delay="0.3s">
            <h3 className="text-highlight-silver text-xs font-bold uppercase tracking-widest mb-4 ml-1">Team Operations</h3>
            <div className={`grid grid-cols-2 ${isAdmin ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-3 md:gap-4`}>
                <QuickAction 
                    icon={ProfileIcon} 
                    label="Profile" 
                    sub="History & Stats" 
                    onClick={() => setActivePage('profile')} 
                />
                <QuickAction 
                    icon={TrackIcon} 
                    label="Events" 
                    sub="Schedule & Results" 
                    onClick={() => setActivePage('events-hub')} 
                />
                <QuickAction 
                    icon={LeagueIcon} 
                    label="League" 
                    sub="Rules & Scoring" 
                    onClick={() => setActivePage('league-hub')} 
                />
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
            : 'bg-carbon-fiber border-pure-white/10 hover:border-primary-red/50 shadow-lg hover:shadow-primary-red/10'
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
