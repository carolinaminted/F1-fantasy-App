
import React, { useState } from 'react';
import { PointsSystem, Driver, Constructor, EntityClass } from '../types.ts';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';

interface PointsTransparencyProps {
    pointsSystem: PointsSystem;
    allDrivers: Driver[];
    allConstructors: Constructor[];
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

interface TeamRosterProps {
    constructors: Constructor[];
    drivers: Driver[];
}

const TeamRoster: React.FC<TeamRosterProps> = ({ constructors, drivers }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Filter teams by class
    const classATeams = constructors.filter(c => c.class === EntityClass.A).sort((a, b) => a.name.localeCompare(b.name));
    const classBTeams = constructors.filter(c => c.class === EntityClass.B).sort((a, b) => a.name.localeCompare(b.name));

    const renderTeamCard = (team: Constructor) => {
        // Find drivers for this team
        const teamDrivers = drivers.filter(d => d.constructorId === team.id);
        
        return (
            <div key={team.id} className={`mb-4 rounded-lg border ${team.isActive ? 'bg-carbon-black/40 border-accent-gray' : 'bg-red-900/10 border-red-900/30 opacity-70'}`}>
                <div className="p-3 border-b border-accent-gray/30 flex justify-between items-center">
                    <span className={`font-bold text-lg ${team.isActive ? 'text-pure-white' : 'text-highlight-silver line-through'}`}>
                        {team.name}
                    </span>
                    {!team.isActive && <span className="text-[10px] uppercase font-bold text-red-400 bg-red-900/40 px-2 py-0.5 rounded">Inactive</span>}
                </div>
                <div className="p-2 space-y-1">
                    {teamDrivers.length > 0 ? (
                        teamDrivers.map(driver => (
                            <div key={driver.id} className="flex items-center gap-2 p-2 rounded hover:bg-pure-white/5">
                                <DriverIcon className="w-4 h-4 text-highlight-silver" />
                                <span className={`text-sm ${driver.isActive ? 'text-ghost-white' : 'text-highlight-silver line-through'}`}>
                                    {driver.name}
                                </span>
                                {!driver.isActive && <span className="text-[10px] uppercase font-bold text-red-400">Inactive</span>}
                            </div>
                        ))
                    ) : (
                        <div className="p-2 text-xs text-highlight-silver italic">No drivers assigned</div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
             <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 hover:bg-pure-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <TeamIcon className="w-6 h-6 text-primary-red" />
                    <h3 className="text-xl font-bold text-pure-white">League Roster (Teams & Drivers)</h3>
                </div>
                 <ChevronDownIcon className={`w-6 h-6 text-highlight-silver transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isOpen && (
                <div className="p-6 border-t border-accent-gray/50 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="text-sm font-bold text-highlight-silver uppercase mb-4 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary-red"></span> Class A
                        </h4>
                        <div className="space-y-4">
                            {classATeams.map(renderTeamCard)}
                        </div>
                    </div>
                     <div>
                        <h4 className="text-sm font-bold text-highlight-silver uppercase mb-4 flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-blue-500"></span> Class B
                        </h4>
                        <div className="space-y-4">
                             {classBTeams.map(renderTeamCard)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const PointsTransparency: React.FC<PointsTransparencyProps> = ({ pointsSystem, allDrivers, allConstructors }) => {
    return (
        <div className="max-w-5xl mx-auto text-pure-white space-y-8">
            <div>
                <h1 className="text-3xl md:text-4xl font-bold text-pure-white mb-2 text-center">Points System</h1>
                <p className="text-center text-highlight-silver">Understand how your fantasy team scores points.</p>
            </div>

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
                    <p className="text-sm text-highlight-silver mb-3">Awarded for the driver who sets the fastest lap of the Grand Prix race.</p>
                    <p className="text-2xl font-bold text-pure-white">{pointsSystem.fastestLap} points</p>
                </PointsCategoryCard>
            </div>
            
            <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-pure-white/10 text-center">
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

            {/* League Roster Section */}
            <div className="pt-8 border-t border-accent-gray/30">
                <h2 className="text-2xl font-bold text-center mb-2">League Roster</h2>
                <p className="text-center text-highlight-silver mb-6">Current active grid classification.</p>
                
                <TeamRoster 
                    constructors={allConstructors}
                    drivers={allDrivers}
                />
            </div>
        </div>
    );
};

export default PointsTransparency;
