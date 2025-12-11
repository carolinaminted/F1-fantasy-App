
import React, { useMemo } from 'react';
import { Driver, Constructor, EntityClass } from '../types.ts';
import { BackIcon } from './icons/BackIcon.tsx';
import { GarageIcon } from './icons/GarageIcon.tsx';
import { CONSTRUCTORS } from '../constants.ts';

interface DriversTeamsPageProps {
    allDrivers: Driver[];
    allConstructors: Constructor[];
    setActivePage: (page: any) => void;
}

const DriversTeamsPage: React.FC<DriversTeamsPageProps> = ({ allDrivers, allConstructors, setActivePage }) => {
    
    // Sort and Group Entities
    const { classATeams, classBTeams } = useMemo(() => {
        const sortedTeams = [...allConstructors].sort((a, b) => a.name.localeCompare(b.name));
        return {
            classATeams: sortedTeams.filter(c => c.class === EntityClass.A),
            classBTeams: sortedTeams.filter(c => c.class === EntityClass.B)
        };
    }, [allConstructors]);

    // Helper to get drivers for a team
    const getTeamDrivers = (teamId: string) => {
        return allDrivers.filter(d => d.constructorId === teamId).sort((a, b) => a.name.localeCompare(b.name));
    };

    const TeamCard: React.FC<{ team: Constructor }> = ({ team }) => {
        const drivers = getTeamDrivers(team.id);
        
        // Robust color resolution: Prop > Constant > Default
        // This handles cases where DB data might be stale and missing the 'color' field
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

        return (
            <div 
                className="relative overflow-hidden rounded-xl bg-carbon-black border transition-all duration-300 hover:scale-[1.01] hover:shadow-lg group"
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
                <div className="relative z-10 p-4">
                    <div className="flex justify-between items-start mb-4 border-b border-pure-white/10 pb-3">
                        <div className="flex flex-col">
                            <h3 className="text-xl font-bold text-pure-white leading-none tracking-tight drop-shadow-md">{team.name}</h3>
                             {!team.isActive && (
                                <span className="inline-block mt-2 self-start text-[10px] font-bold uppercase bg-red-900/50 text-red-200 px-2 py-0.5 rounded border border-red-500/30">
                                    Inactive
                                </span>
                            )}
                        </div>
                        {/* Vertical Pill Indicator */}
                        <div 
                            className="w-1.5 h-10 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" 
                            style={{ backgroundColor: teamColor, boxShadow: `0 0 12px ${teamColor}` }} 
                        />
                    </div>

                    <div className="space-y-3">
                        {drivers.length > 0 ? (
                            drivers.map(driver => (
                                <div key={driver.id} className="flex items-center gap-3">
                                    {/* Driver bullet */}
                                    <div 
                                        className={`w-2 h-2 rounded-full ${driver.isActive ? '' : 'bg-red-500'}`}
                                        style={{ backgroundColor: driver.isActive ? teamColor : undefined, boxShadow: driver.isActive ? `0 0 8px ${teamColor}` : 'none' }}
                                    ></div>
                                    <span className={`text-base font-semibold tracking-wide ${driver.isActive ? 'text-ghost-white' : 'text-highlight-silver line-through opacity-60'}`}>
                                        {driver.name}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="text-xs text-highlight-silver italic py-2 opacity-50">No drivers confirmed</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col text-pure-white max-w-7xl mx-auto w-full overflow-x-hidden">
             {/* Header */}
             <div className="flex items-center justify-between mb-6 px-2 md:px-0">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setActivePage('home')}
                        className="md:hidden p-2 -ml-2 text-highlight-silver hover:text-pure-white"
                    >
                        <BackIcon className="w-5 h-5" />
                    </button>
                    <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                        <GarageIcon className="w-8 h-8 text-primary-red"/> 
                        <span>Drivers & Teams</span>
                    </h1>
                </div>
                <div className="text-xs font-bold text-highlight-silver bg-accent-gray/30 px-3 py-1.5 rounded-full border border-pure-white/10 hidden sm:block">
                    2026 Season Grid
                </div>
            </div>

            {/* Grid Area - No internal scroll, flows with page */}
            <div className="px-1 md:px-0 pb-12">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    
                    {/* Class A Column */}
                    <div className="space-y-4">
                        <div className="sticky top-0 z-20 bg-carbon-black/95 backdrop-blur-md py-3 border-b border-primary-red/30 mb-2 shadow-lg shadow-black/50">
                            <h2 className="text-xl font-bold text-pure-white flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-primary-red shadow-[0_0_8px_rgba(218,41,28,0.6)]"></span>
                                Class A Constructors
                            </h2>
                            <p className="text-xs text-highlight-silver mt-1 font-mono">Select 2 Teams · Select 3 Drivers</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                            {classATeams.map(team => <TeamCard key={team.id} team={team} />)}
                        </div>
                    </div>

                    {/* Class B Column */}
                    <div className="space-y-4">
                        <div className="sticky top-0 z-20 bg-carbon-black/95 backdrop-blur-md py-3 border-b border-blue-500/30 mb-2 shadow-lg shadow-black/50">
                            <h2 className="text-xl font-bold text-pure-white flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></span>
                                Class B Constructors
                            </h2>
                             <p className="text-xs text-highlight-silver mt-1 font-mono">Select 1 Team · Select 2 Drivers</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                            {classBTeams.map(team => <TeamCard key={team.id} team={team} />)}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default DriversTeamsPage;
