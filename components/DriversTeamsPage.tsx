
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
    'cadillac': 'https://www.formula1.com/en/teams/cadillac',
};

const DriversTeamsPage: React.FC<DriversTeamsPageProps> = ({ allDrivers, allConstructors, setActivePage }) => {
    
    // Sort and Group Entities
    const { classATeams, classBTeams } = useMemo(() => {
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

    const getTeamDrivers = (teamId: string) => {
        return allDrivers.filter(d => d.constructorId === teamId).sort((a, b) => a.name.localeCompare(b.name));
    };

    const HeaderControls = (
        <div className="text-xs font-bold text-highlight-silver bg-accent-gray/30 px-3 py-1.5 rounded-full border border-pure-white/10 hidden sm:block">
            2026 Season Grid
        </div>
    );

    const hubAction = (
        <button 
            onClick={() => setActivePage('league-hub')}
            className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors bg-carbon-black/50 px-4 py-2 rounded-lg border border-pure-white/10 hover:border-pure-white/30"
        >
            <BackIcon className="w-4 h-4" /> 
            <span className="text-sm font-bold">League Hub</span>
        </button>
    );

    const TeamCard: React.FC<{ team: Constructor }> = ({ team }) => {
        const drivers = getTeamDrivers(team.id);
        
        let teamColor = team.color;
        if (!teamColor) {
             const constantTeam = CONSTRUCTORS.find(c => c.id === team.id);
             teamColor = constantTeam?.color;
        }
        teamColor = teamColor || '#888888';
        
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
                className={`relative overflow-hidden rounded-xl bg-carbon-black border transition-all duration-300 hover:scale-[1.01] hover:shadow-lg group md:flex md:flex-col ${teamUrl ? 'cursor-pointer' : ''} min-h-[100px] md:min-h-0`}
                style={{ 
                    borderColor: `${teamColor}40`, 
                    boxShadow: `0 0 10px ${hexToRgba(teamColor, 0.03)}`
                }} 
            >
                <div 
                    className="absolute inset-0 z-0 pointer-events-none opacity-10 transition-opacity duration-300 group-hover:opacity-20"
                    style={{ background: `linear-gradient(135deg, ${teamColor} 0%, transparent 75%)` }}
                />

                <div className="relative z-10 p-4 md:flex-1 md:flex md:flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-2 border-b border-pure-white/10 pb-2 md:flex-shrink-0">
                        <div className="flex flex-col justify-center min-w-0 flex-1">
                            <h3 className="text-lg md:text-base font-black text-pure-white leading-none tracking-tight flex items-center gap-1.5 truncate uppercase">
                                {team.name}
                                {teamUrl && (
                                    <svg className="w-3 h-3 text-highlight-silver opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                )}
                            </h3>
                        </div>
                        <div 
                            className="w-1.5 h-6 md:h-7 rounded-full ml-2 flex-shrink-0" 
                            style={{ backgroundColor: teamColor, boxShadow: `0 0 8px ${teamColor}60` }} 
                        />
                    </div>

                    <div className="space-y-1.5 md:flex-1 md:flex md:flex-col md:justify-center overflow-hidden">
                        {drivers.length > 0 ? (
                            drivers.map(driver => (
                                <div key={driver.id} className="flex items-center gap-2 min-w-0">
                                    <div 
                                        className={`w-2 h-2 rounded-full flex-shrink-0 ${driver.isActive ? '' : 'bg-red-500'}`}
                                        style={{ backgroundColor: driver.isActive ? teamColor : undefined }}
                                    ></div>
                                    <span className={`text-sm md:text-xs font-bold tracking-tight truncate ${driver.isActive ? 'text-ghost-white' : 'text-highlight-silver line-through opacity-60'}`}>
                                        {driver.name}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-[10px] text-highlight-silver italic opacity-50">TBA</div>
                        )}
                    </div>
                </div>
            </CardComponent>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden text-pure-white max-w-7xl mx-auto w-full">
            <div className="flex-none">
                 <PageHeader 
                    title="DRIVERS & TEAMS" 
                    icon={GarageIcon} 
                    subtitle="Constructor Rosters & Driver Line-ups"
                    rightAction={HeaderControls}
                    leftAction={hubAction}
                />
            </div>

            {/* Scrollable area - removed md:overflow-hidden to allow natural flow if containers are shorter than viewport */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-2 md:px-0 pb-12 md:pb-8">
                {/* Changed h-full to auto on grid and columns to recapture vertical dead space */}
                <div className="grid grid-cols-1 lg:grid-cols-11 gap-6 items-start">
                    
                    {/* Class A Column - Wider (6/11) and 2 columns inner */}
                    <div className="lg:col-span-6 flex flex-col bg-carbon-fiber/30 rounded-xl border border-pure-white/5 overflow-hidden shadow-2xl">
                        <div className="bg-carbon-black/95 backdrop-blur-md py-3 px-4 border-b border-primary-red/30 flex-shrink-0">
                            <h2 className="text-lg font-black text-pure-white flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-2.5 h-2.5 rounded-full bg-primary-red shadow-[0_0_8px_rgba(218,41,28,0.6)]"></span>
                                Class A Constructors
                            </h2>
                        </div>
                        <div className="p-4">
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {classATeams.map(team => (
                                    <TeamCard key={team.id} team={team} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Class B Column - Narrower (5/11) and 2 columns inner */}
                    <div className="lg:col-span-5 flex flex-col bg-carbon-fiber/30 rounded-xl border border-pure-white/5 overflow-hidden shadow-2xl">
                        <div className="bg-carbon-black/95 backdrop-blur-md py-3 px-4 border-b border-blue-500/30 flex-shrink-0">
                            <h2 className="text-lg font-black text-pure-white flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
                                Class B Constructors
                            </h2>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {classBTeams.map(team => (
                                    <TeamCard key={team.id} team={team} />
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