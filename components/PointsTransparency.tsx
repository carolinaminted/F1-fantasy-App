
import React from 'react';
import { PointsSystem } from '../types.ts';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';

interface PointsTransparencyProps {
    pointsSystem: PointsSystem;
}

const PointsCategoryCard: React.FC<{ title: string; icon: React.FC<any>; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10 text-center">
        <h3 className="text-xl font-bold text-pure-white mb-4 flex items-center justify-center gap-3">
            <Icon className="w-6 h-6 text-primary-red" />
            {title}
        </h3>
        {children}
    </div>
);

const PointsList: React.FC<{ points: number[] }> = ({ points }) => (
    <div className="space-y-1 text-ghost-white inline-block text-left">
        {points.map((p, i) => (
            <div key={i}>
                Position {i + 1}: <span className="font-bold text-pure-white">{p} points</span>
            </div>
        ))}
    </div>
);

const PointsTransparency: React.FC<PointsTransparencyProps> = ({ pointsSystem }) => {
    return (
        <div className="max-w-5xl mx-auto text-pure-white">
            <h1 className="text-3xl md:text-4xl font-bold text-pure-white mb-2 text-center">Points System</h1>
            <p className="text-center text-highlight-silver mb-8">Understand how your fantasy team scores points each race weekend.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PointsCategoryCard title="Grand Prix Finish" icon={CheckeredFlagIcon}>
                    <p className="text-sm text-highlight-silver mb-3">Points are awarded for the top 10 finishers in the main race.</p>
                    <PointsList points={pointsSystem.grandPrixFinish} />
                </PointsCategoryCard>
                
                <PointsCategoryCard title="Sprint Race Finish" icon={SprintIcon}>
                    <p className="text-sm text-highlight-silver mb-3">Awarded for the top 8 finishers in Sprint events.</p>
                    <PointsList points={pointsSystem.sprintFinish} />
                </PointsCategoryCard>

                <PointsCategoryCard title="GP Qualifying" icon={PolePositionIcon}>
                    <p className="text-sm text-highlight-silver mb-3">Awarded for the top 3 in Grand Prix + Sprint qualifying events</p>
                    <PointsList points={pointsSystem.gpQualifying} />
                </PointsCategoryCard>
                
                <PointsCategoryCard title="Fastest Lap" icon={FastestLapIcon}>
                    <p className="text-sm text-highlight-silver mb-3">Awarded for picking the driver who sets the fastest lap of the Grand Prix qualifying</p>
                    <p className="text-2xl font-bold text-pure-white">{pointsSystem.fastestLap} points</p>
                </PointsCategoryCard>
            </div>
            
            <div className="mt-6 bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10 text-center">
                <h2 className="text-2xl font-bold text-center mb-4">How It Adds Up</h2>
                <div className="space-y-4 text-highlight-silver max-w-3xl mx-auto">
                    <p>
                        <strong className="text-ghost-white">Team Points:</strong> For each of your chosen teams, you score the total points earned by <em className="italic">both</em> of that constructor's drivers in a session (e.g., if you pick Ferrari, you get Leclerc's points + Hamilton's points).
                    </p>
                     <p>
                        <strong className="text-ghost-white">Driver Points:</strong> For each of your chosen drivers, you score the points they earn individually.
                    </p>
                     <p>
                        <strong className="text-ghost-white">Total Event Score:</strong> Your total score for an event is the sum of all your team points, all your driver points, and any fastest lap bonus points across all relevant sessions (GP, Sprint, etc.).
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PointsTransparency;
