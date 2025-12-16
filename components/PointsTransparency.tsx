
import React from 'react';
import { PointsSystem, Driver, Constructor } from '../types.ts';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { TrophyIcon } from './icons/TrophyIcon.tsx';

interface PointsTransparencyProps {
    pointsSystem: PointsSystem;
    allDrivers: Driver[];
    allConstructors: Constructor[];
}

const PointTile: React.FC<{ rank: number; points: number; isTop?: boolean }> = ({ rank, points, isTop }) => (
    <div className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-300 hover:scale-105 ${isTop ? 'bg-gradient-to-b from-primary-red/10 to-transparent border-primary-red/30 shadow-[0_0_15px_rgba(218,41,28,0.1)]' : 'bg-carbon-black/20 border-pure-white/5 hover:bg-pure-white/5'}`}>
        <span className={`text-xs md:text-sm font-black uppercase tracking-widest mb-1 ${isTop ? 'text-primary-red' : 'text-highlight-silver'}`}>
            {rank === 1 ? 'Winner' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `P${rank}`}
        </span>
        <span className="text-3xl md:text-4xl font-black text-pure-white leading-none mb-1">{points}</span>
        <span className="text-[10px] md:text-xs font-bold text-highlight-silver/60 uppercase tracking-widest">Points</span>
    </div>
);

const QualiRow: React.FC<{ rank: number; points: number }> = ({ rank, points }) => (
    <div className="flex justify-between items-center py-2 border-b border-pure-white/5 last:border-0">
        <span className="text-highlight-silver text-sm font-mono">Q{rank}</span>
        <span className="font-bold text-pure-white">{points} <span className="text-[10px] text-highlight-silver font-normal">pts</span></span>
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
        <div className={`px-4 py-3 flex items-center gap-3 border-b border-pure-white/5 bg-carbon-black/20 flex-shrink-0`}>
            <div className={`p-2 rounded-lg ${headerColor || 'bg-pure-white/5 text-pure-white'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-base font-bold text-pure-white leading-none">{title}</h3>
                {subtitle && <p className="text-[10px] text-highlight-silver mt-0.5">{subtitle}</p>}
            </div>
        </div>
        {/* Body */}
        <div className="p-4 flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
            {children}
        </div>
    </div>
);

const PointsTransparency: React.FC<PointsTransparencyProps> = ({ pointsSystem }) => {
    
    return (
        <div className="flex flex-col w-full max-w-7xl mx-auto space-y-4 pb-2 md:h-[calc(100vh-6rem)] md:overflow-hidden">
            
            {/* Page Header */}
            <div className="flex-none text-center md:text-left flex flex-col md:flex-row items-center gap-4 border-b border-pure-white/10 pb-4">
                <div className="bg-primary-red/10 p-3 rounded-full">
                    <TrophyIcon className="w-8 h-8 text-primary-red" />
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-pure-white">Scoring System</h1>
                    <p className="text-highlight-silver text-sm">Official point distributions for the 2026 Season.</p>
                </div>
            </div>

            {/* Dashboard Grid - Two Columns: Left (Events) Right (Meta) */}
            <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* LEFT COLUMN: RACE EVENTS (Rows for GP and Sprint) */}
                <div className="md:col-span-9 flex flex-col gap-4 h-full min-h-0">
                    
                    {/* TOP: Grand Prix */}
                    <PointsCard 
                        title="Grand Prix" 
                        subtitle="Sunday Feature Race (Top 10)" 
                        icon={CheckeredFlagIcon} 
                        className="flex-[1.1] min-h-0"
                        headerColor="bg-primary-red text-pure-white"
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 h-full content-center">
                            {pointsSystem.grandPrixFinish.map((p, i) => (
                                <PointTile key={i} rank={i + 1} points={p} isTop={i < 3} />
                            ))}
                        </div>
                    </PointsCard>

                    {/* BOTTOM: Sprint */}
                    <PointsCard 
                        title="Sprint Race" 
                        subtitle="Saturday Sprint (Top 8)" 
                        icon={SprintIcon} 
                        className="flex-1 min-h-0"
                        headerColor="bg-pure-white text-carbon-black"
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 h-full content-center">
                            {pointsSystem.sprintFinish.map((p, i) => (
                                <PointTile key={i} rank={i + 1} points={p} isTop={i === 0} />
                            ))}
                        </div>
                    </PointsCard>

                </div>

                {/* RIGHT COLUMN: SIDEBAR (Quali, Bonuses, Info) */}
                <div className="md:col-span-3 flex flex-col gap-4 h-full min-h-0">
                    
                    {/* Quali */}
                    <PointsCard 
                        title="Qualifying" 
                        subtitle="GP & Sprint Sessions" 
                        icon={PolePositionIcon} 
                        className="flex-none"
                        headerColor="bg-blue-600 text-pure-white"
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
                        className="flex-none"
                        headerColor="bg-purple-600 text-pure-white"
                    >
                        <div className="flex items-center justify-between py-2">
                            <span className="text-xs text-highlight-silver uppercase tracking-wider">Bonus</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-black text-purple-500">{pointsSystem.fastestLap}</span>
                                <span className="text-xs text-purple-300">pts</span>
                            </div>
                        </div>
                    </PointsCard>

                    {/* Logic Breakdown */}
                    <div className="bg-carbon-fiber rounded-xl p-5 border border-pure-white/10 flex-grow flex flex-col justify-center shadow-lg min-h-0 overflow-hidden">
                        <div className="flex flex-col gap-3 text-xs leading-relaxed text-ghost-white">
                            <div>
                                <span className="block text-primary-red font-bold uppercase tracking-wider mb-1">Team Score</span>
                                <p className="opacity-80 leading-snug">Sum of <em className="text-pure-white">both</em> drivers' points for that session.</p>
                            </div>
                            <div>
                                <span className="block text-blue-400 font-bold uppercase tracking-wider mb-1">Driver Score</span>
                                <p className="opacity-80 leading-snug">Points earned individually by the driver.</p>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-pure-white/5 mt-3">
                            <p className="text-[10px] text-center italic opacity-50">
                                Total = Teams + Drivers + Bonuses - Penalties
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default PointsTransparency;
