
import React from 'react';
import { PointsSystem, Driver, Constructor } from '../types.ts';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
import { Page } from '../App.tsx';
import { BackIcon } from './icons/BackIcon.tsx';

interface PointsTransparencyProps {
    pointsSystem: PointsSystem;
    allDrivers: Driver[];
    allConstructors: Constructor[];
    setActivePage: (page: Page) => void;
}

const PointTile: React.FC<{ rank: number; points: number; isTop?: boolean }> = ({ rank, points, isTop }) => (
    <div className={`relative flex flex-col items-center justify-center p-2 md:p-3 rounded-xl border transition-all duration-300 hover:scale-105 ${isTop ? 'bg-gradient-to-b from-primary-red/10 to-transparent border-primary-red/30 shadow-[0_0_15px_rgba(218,41,28,0.1)]' : 'bg-carbon-black/20 border-pure-white/5 hover:bg-pure-white/5'}`}>
        <span className={`text-[10px] md:text-sm font-black uppercase tracking-widest mb-1 ${isTop ? 'text-primary-red' : 'text-highlight-silver'}`}>
            {rank === 1 ? 'Winner' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `P${rank}`}
        </span>
        <span className="text-2xl md:text-4xl font-black text-pure-white leading-none mb-1">{points}</span>
        <span className="text-[9px] md:text-xs font-bold text-highlight-silver/60 uppercase tracking-widest">Points</span>
    </div>
);

const QualiRow: React.FC<{ rank: number; points: number }> = ({ rank, points }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-pure-white/5 last:border-0">
        {/* Adjusted labels to Q2/Q3 if it's the last two ranks of a 3-part qualifying system, 
            or keep Q1-3 based on actual system index. F1 usually awards for Q1/2/3 logic in fantasy. */}
        <span className="text-highlight-silver text-sm font-bold uppercase tracking-widest">Q{rank}</span>
        <span className="font-bold text-pure-white text-lg">{points} <span className="text-xs text-highlight-silver font-normal uppercase">pts</span></span>
    </div>
);

const PointsCard: React.FC<{ 
    title: string; 
    icon: React.FC<any>; 
    subtitle?: string;
    className?: string;
    headerColor?: string;
    children: React.ReactNode;
}> = ({ title, icon: Icon, subtitle, className, headerColor, children }) => (
    <div className={`bg-carbon-fiber rounded-xl ring-1 ring-pure-white/10 flex flex-col overflow-hidden shadow-lg ${className}`}>
        {/* Header */}
        <div className={`px-4 py-3.5 flex items-center gap-3 border-b border-pure-white/5 bg-carbon-black/20 flex-shrink-0`}>
            <div className={`p-2 rounded-lg ${headerColor || 'bg-pure-white/5 text-pure-white'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-base font-bold text-pure-white leading-none uppercase tracking-wider">{title}</h3>
                {subtitle && <p className="text-[10px] text-highlight-silver mt-1 uppercase font-semibold tracking-tight">{subtitle}</p>}
            </div>
        </div>
        {/* Body */}
        <div className="p-4 flex-1 flex flex-col justify-center min-h-0">
            {children}
        </div>
    </div>
);

const PointsTransparency: React.FC<PointsTransparencyProps> = ({ pointsSystem, setActivePage }) => {
    
    const hubAction = (
        <button 
            onClick={() => setActivePage('league-hub')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">League Hub</span>
        </button>
    );

    return (
        <div className="flex flex-col md:h-full w-full max-w-7xl mx-auto md:pb-safe">
            <div className="flex-none">
                <PageHeader 
                    title="SCORING RULES" 
                    icon={TrophyIcon} 
                    leftAction={hubAction}
                />
            </div>

            {/* Dashboard Grid - Using h-full context to align columns on desktop, auto on mobile */}
            <div 
                className="md:flex-1 md:overflow-y-auto custom-scrollbar md:min-h-0 px-1"
                style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}
            >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-auto md:min-h-full content-start pb-24 md:pb-0">
                    
                    {/* LEFT COLUMN: RACE EVENTS */}
                    <div className="md:col-span-8 flex flex-col gap-4">
                        
                        {/* Grand Prix */}
                        <PointsCard 
                            title="Grand Prix" 
                            subtitle="Sunday Feature Race (Top 10)" 
                            icon={CheckeredFlagIcon} 
                            headerColor="bg-primary-red text-pure-white"
                        >
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {pointsSystem.grandPrixFinish.map((p, i) => (
                                    <PointTile key={i} rank={i + 1} points={p} isTop={i < 3} />
                                ))}
                            </div>
                        </PointsCard>

                        {/* Sprint Race */}
                        <PointsCard 
                            title="Sprint Race" 
                            subtitle="Saturday Sprint (Top 8)" 
                            icon={SprintIcon} 
                            headerColor="bg-carbon-black text-pure-white"
                        >
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {pointsSystem.sprintFinish.map((p, i) => (
                                    <PointTile key={i} rank={i + 1} points={p} isTop={i === 0} />
                                ))}
                            </div>
                        </PointsCard>

                    </div>

                    {/* RIGHT COLUMN: SIDEBAR - Height matched flex container */}
                    <div className="md:col-span-4 flex flex-col gap-4 h-full">
                        
                        {/* Qualifying */}
                        <PointsCard 
                            title="Qualifying" 
                            subtitle="GP & Sprint Sessions" 
                            icon={PolePositionIcon} 
                            headerColor="bg-blue-600 text-pure-white"
                            className="flex-none"
                        >
                            <div className="space-y-1">
                                {pointsSystem.gpQualifying.map((p, i) => (
                                    <QualiRow key={i} rank={i + 1} points={p} />
                                ))}
                            </div>
                        </PointsCard>

                        {/* Fastest Lap */}
                        <PointsCard 
                            title="Fastest Lap" 
                            icon={FastestLapIcon} 
                            headerColor="bg-purple-600 text-pure-white"
                            className="flex-none"
                        >
                            <div className="flex items-center justify-between py-2">
                                <span className="text-xs text-highlight-silver uppercase tracking-widest font-bold">Award Bonus</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-purple-500">{pointsSystem.fastestLap}</span>
                                    <span className="text-xs text-purple-300 font-bold uppercase">pts</span>
                                </div>
                            </div>
                        </PointsCard>

                        {/* Logic Breakdown / Rules Info - flex-1 to fill the vertical gap and align bottom */}
                        <div className="bg-carbon-fiber rounded-xl p-5 border border-pure-white/10 flex flex-col justify-between shadow-lg flex-1 min-h-[160px]">
                            <div>
                                <h4 className="text-xs font-black text-highlight-silver uppercase tracking-[0.2em] mb-4">Scoring Mechanics</h4>
                                <div className="space-y-4">
                                    <div className="flex gap-4">
                                        <div className="w-1.5 h-auto rounded-full bg-primary-red flex-shrink-0"></div>
                                        <div className="flex-1">
                                            <span className="block text-primary-red font-black text-[10px] uppercase tracking-wider mb-1">Team Score</span>
                                            <p className="text-xs leading-relaxed text-ghost-white opacity-80 italic">Sum of <strong className="text-pure-white not-italic">both</strong> drivers' points for the session.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-1.5 h-auto rounded-full bg-blue-400 flex-shrink-0"></div>
                                        <div className="flex-1">
                                            <span className="block text-blue-400 font-black text-[10px] uppercase tracking-wider mb-1">Driver Score</span>
                                            <p className="text-xs leading-relaxed text-ghost-white opacity-80 italic">Points earned individually by your <strong className="text-pure-white not-italic">selected</strong> drivers.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-pure-white/5 mt-4">
                                <p className="text-[10px] text-center font-mono text-highlight-silver opacity-40 uppercase tracking-widest">
                                    Total = Teams + Drivers + FL - Pen.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default PointsTransparency;
