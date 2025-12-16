
import React, { useMemo, useState } from 'react';
import { Driver, Constructor, EntityClass } from '../types.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { GarageIcon } from './icons/GarageIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { SaveIcon } from './icons/SaveIcon.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import { PageHeader } from './ui/PageHeader.tsx';

interface DriversTeamsPageProps {
    allDrivers: Driver[];
    allConstructors: Constructor[];
    setActivePage: (page: any) => void;
}

const TEAM_URLS: Record<string, string> = {
    'mclaren': 'https://www.formula1.com/en/teams/mclaren',
    'mercedes': 'https://www.formula1.com/en/teams/mercedes',
    'red_bull': 'https://www.formula1.com/en/teams/red-bull-racing',
    'ferrari': 'https://www.formula1.com/en/teams/ferrari',
    'williams': 'https://www.formula1.com/en/teams/williams',
    'racing_bulls': 'https://www.formula1.com/en/teams/racing-bulls',
    'aston_martin': 'https://www.formula1.com/en/teams/aston-martin',
    'haas': 'https://www.formula1.com/en/teams/haas',
    'audi': 'https://www.formula1.com/en/teams/kick-sauber',
    'alpine': 'https://www.formula1.com/en/teams/alpine',
};

const DriversTeamsPage: React.FC<DriversTeamsPageProps> = ({ allDrivers, allConstructors, setActivePage }) => {
    // Note: State logic for toggling views isn't strictly needed if we show everything, 
    // but the original code had checks. Assuming we just show the grid. 
    // If the user wants separate views, we can implement that. 
    // The previous implementation showed all on desktop in columns.
    
    // Sort and Group Entities
    const { classATeams, classBTeams } = useMemo(() => {
        // Helper to get rank from constants (2025 Standings Order)
        const getTeamRank = (id: string) => {
            const index = CONSTRUCTORS.findIndex(c => c.id === id);
            return index === -1 ? 999 : index;
        };

        const sortedTeams = [...allConstructors].sort((a, b) => {
             return getTeamRank(a.id) - getTeamRank(b.id);
        });

        return {
            classATeams: sortedTeams.filter(c => c.class === EntityClass.A),
            classBTeams: sortedTeams.filter(c => c.class === EntityClass.B)
        };
    }, [allConstructors]);

    // Helper to get drivers for a team
    const getTeamDrivers = (teamId: string) => {
        return allDrivers.filter(d => d.constructorId === teamId).sort((a, b) => a.name.localeCompare(b.name));
    };

    const HeaderControls = (
        <div className="text-xs font-bold text-highlight-silver bg-accent-gray/30 px-3 py-1.5 rounded-full border border-pure-white/10 hidden sm:block">
            2026 Season Grid
        </div>
    );

    const TeamCard: React.FC<{ team: Constructor }> = ({ team }) => {
        const drivers = getTeamDrivers(team.id);
        
        // Robust color resolution: Prop > Constant > Default
        let teamColor = team.color;
        if (!teamColor) {
             const constantTeam = CONSTRUCTORS.find(c => c.id === team.id);
             teamColor = constantTeam?.color;
        }
        teamColor = teamColor || '#888888';
        
        // Calculate RGBA for background tint
        const hexToRgba = (hex: string, alpha: number) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        const teamUrl = TEAM_URLS[team.id];
        const CardComponent = teamUrl ? 'a' : 'div';
        const cardProps = teamUrl ? {
            href: teamUrl,
            target: '_blank',
            rel: 'noopener noreferrer'
        } : {};

        return (
            <CardComponent 
                {...cardProps}
                className={`relative overflow-hidden rounded-xl bg-carbon-black border transition-all duration-300 hover:scale-[1.01] hover:shadow-lg group md:h-full md:flex md:flex-col ${teamUrl ? 'cursor-pointer' : ''}`}
                style={{ 
                    borderColor: `${teamColor}60`, 
                    boxShadow: `0 0 20px ${hexToRgba(teamColor, 0.1)}`
                }} 
            >
                {/* Color Flare Background - Stronger gradient */}
                <div 
                    className="absolute inset-0 z-0 pointer-events-none opacity-20 transition-opacity duration-300 group-hover:opacity-30"
                    style={{ background: `linear-gradient(135deg, ${teamColor} 0%, transparent 75%)` }}
                />

                {/* Content */}
                <div className="relative z-10 p-4 md:p-3 md:flex-1 md:flex md:flex-col">
                    <div className="flex justify-between items-start mb-4 md:mb-1 border-b border-pure-white/10 pb-3 md:pb-2 md:flex-shrink-0">
                        <div className="flex flex-col justify-center">
                            <h3 className="text-xl md:text-lg font-bold text-pure-white leading-none tracking-tight drop-shadow-md flex items-center gap-2">
                                {team.name}
                                {teamUrl && (
                                    <svg className="w-3 h-3 text-highlight-silver opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                )}
                            </h3>
                             {!team.isActive && (
                                <span className="inline-block mt-2 md:mt-1 self-start text-[10px] font-bold uppercase bg-red-900/50 text-red-200 px-2 py-0.5 rounded border border-red-500/30">
                                    Inactive
                                </span>
                            )}
                        </div>
                        {/* Vertical Pill Indicator */}
                        <div 
                            className="w-1.5 h-10 md:h-full md:max-h-8 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" 
                            style={{ backgroundColor: teamColor, boxShadow: `0 0 12px ${teamColor}` }} 
                        />
                    </div>

                    <div className="space-y-3 md:space-y-0 md:flex-1 md:flex md:flex-col md:justify-around">
                        {drivers.length > 0 ? (
                            drivers.map(driver => (
                                <div key={driver.id} className="flex items-center gap-3 md:gap-2">
                                    {/* Driver bullet */}
                                    <div 
                                        className={`w-2 h-2 rounded-full ${driver.isActive ? '' : 'bg-red-500'}`}
                                        style={{ backgroundColor: driver.isActive ? teamColor : undefined, boxShadow: driver.isActive ? `0 0 8px ${teamColor}` : 'none' }}
                                    ></div>
                                    <span className={`text-base md:text-sm font-semibold tracking-wide ${driver.isActive ? 'text-ghost-white' : 'text-highlight-silver line-through opacity-60'}`}>
                                        {driver.name}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-xs text-highlight-silver italic py-2 opacity-50">No drivers confirmed</div>
                        )}
                    </div>
                </div>
            </CardComponent>
        );
    };

    return (
        <div className="flex flex-col text-pure-white max-w-7xl mx-auto w-full md:h-[calc(100vh-6rem)] md:overflow-hidden">
             <PageHeader 
                title="DRIVERS & TEAMS" 
                icon={GarageIcon} 
                subtitle="Constructor Rosters & Driver Line-ups"
                rightAction={HeaderControls}
            />

            {/* Grid Area */}
            <div className="flex-1 min-h-0 px-1 md:px-0 pb-12 md:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start md:h-full">
                    
                    {/* Class A Column - 1/3 Width */}
                    <div className="lg:col-span-1 flex flex-col md:h-full md:bg-accent-gray/10 md:rounded-xl md:border md:border-pure-white/5 md:overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="sticky top-0 md:static z-20 bg-carbon-black/95 backdrop-blur-md py-4 px-4 border-b border-primary-red/30 mb-2 md:mb-0 shadow-lg shadow-black/50 md:shadow-none flex-shrink-0">
                            <h2 className="text-xl font-bold text-pure-white flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-primary-red shadow-[0_0_8px_rgba(218,41,28,0.6)]"></span>
                                Class A Constructors
                            </h2>
                        </div>
                        {/* List */}
                        <div className="md:flex-1 md:overflow-hidden md:p-3 scrollbar-thin scrollbar-thumb-accent-gray scrollbar-track-transparent">
                             <div className="grid grid-cols-1 gap-4 md:flex md:flex-col md:h-full md:gap-3">
                                {classATeams.map(team => (
                                    <div key={team.id} className="md:flex-1 md:min-h-0">
                                        <TeamCard team={team} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Class B Column - 2/3 Width */}
                    <div className="lg:col-span-2 flex flex-col md:h-full md:bg-accent-gray/10 md:rounded-xl md:border md:border-pure-white/5 md:overflow-hidden shadow-2xl">
                        {/* Header */}
                        <div className="sticky top-0 md:static z-20 bg-carbon-black/95 backdrop-blur-md py-4 px-4 border-b border-blue-500/30 mb-2 md:mb-0 shadow-lg shadow-black/50 md:shadow-none flex-shrink-0">
                            <h2 className="text-xl font-bold text-pure-white flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
                                Class B Constructors
                            </h2>
                        </div>
                        {/* List - Grid 2 Cols on Desktop */}
                        <div className="md:flex-1 md:overflow-hidden md:p-3 scrollbar-thin scrollbar-thumb-accent-gray scrollbar-track-transparent">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:grid-cols-2 md:grid-rows-3 md:h-full md:gap-3">
                                {classBTeams.map(team => (
                                    <div key={team.id} className="md:min-h-0">
                                        <TeamCard team={team} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default DriversTeamsPage;
