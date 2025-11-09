// Fix: Implement the ProfilePage component to display user stats and picks history.
import React, { useState } from 'react';
import { User, PickSelection, RaceResults, EntityClass } from '../types';
import useFantasyData from '../hooks/useFantasyData';
import { calculatePointsForEvent } from '../services/scoringService';
import { EVENTS, CONSTRUCTORS, DRIVERS } from '../constants';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon';
import { SprintIcon } from './icons/SprintIcon';
import { PolePositionIcon } from './icons/PolePositionIcon';
import { FastestLapIcon } from './icons/FastestLapIcon';
import { ProfileIcon } from './icons/ProfileIcon';
import { LeaderboardIcon } from './icons/LeaderboardIcon';

interface ProfilePageProps {
  user: User;
  seasonPicks: { [eventId: string]: PickSelection };
  raceResults: RaceResults;
}

const UsageMeter: React.FC<{ label: string; used: number; limit: number; }> = ({ label, used, limit }) => {
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-semibold text-ghost-white">{label}</span>
        <span className="text-sm font-mono text-highlight-silver">{used} / {limit}</span>
      </div>
      <div className="w-full bg-carbon-black rounded-full h-2.5">
        <div 
          className="bg-primary-red h-2.5 rounded-full" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

const ProfilePage: React.FC<ProfilePageProps> = ({ user, seasonPicks, raceResults }) => {
  const { scoreRollup, usageRollup, getLimit } = useFantasyData(seasonPicks, raceResults);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  
  const aTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.A);
  const bTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.B);
  const aDrivers = DRIVERS.filter(d => d.class === EntityClass.A);
  const bDrivers = DRIVERS.filter(d => d.class === EntityClass.B);

  const toggleEvent = (eventId: string) => {
    setExpandedEvent(prev => (prev === eventId ? null : eventId));
  };
  
  const getEntityName = (id: string | null) => {
    if (!id) return 'N/A';
    return DRIVERS.find(d => d.id === id)?.name || CONSTRUCTORS.find(c => c.id === id)?.name || 'Unknown';
  };

  return (
    <div className="max-w-4xl mx-auto text-pure-white space-y-12">
      <div>
        <h1 className="text-4xl font-bold text-center mb-2">{user.displayName}</h1>
        <p className="text-center text-xl text-highlight-silver mb-8">Total Points: <span className="font-bold text-pure-white">{scoreRollup.totalPoints}</span></p>
      </div>

      {/* Scoring Breakdown Section */}
      <div className="rounded-lg p-6 ring-1 ring-pure-white/10">
        <h2 className="text-2xl font-bold mb-6 text-center">Scoring Breakdown</h2>
        <div className="grid grid-cols-2 gap-y-6 gap-x-4 text-center">
            <div>
                <CheckeredFlagIcon className="w-8 h-8 text-primary-red mb-2 mx-auto"/>
                <p className="text-sm text-highlight-silver">Grand Prix</p>
                <p className="font-bold text-2xl text-pure-white">{scoreRollup.grandPrixPoints}</p>
            </div>
            <div>
                <SprintIcon className="w-8 h-8 text-primary-red mb-2 mx-auto"/>
                <p className="text-sm text-highlight-silver">Sprint Race</p>
                <p className="font-bold text-2xl text-pure-white">{scoreRollup.sprintPoints}</p>
            </div>
            <div>
                <FastestLapIcon className="w-8 h-8 text-primary-red mb-2 mx-auto"/>
                <p className="text-sm text-highlight-silver">Fastest Lap</p>
                <p className="font-bold text-2xl text-pure-white">{scoreRollup.fastestLapPoints}</p>
            </div>
            <div>
                <LeaderboardIcon className="w-8 h-8 text-primary-red mb-2 mx-auto"/>
                <p className="text-sm text-highlight-silver">GP Quali</p>
                <p className="font-bold text-2xl text-pure-white">{scoreRollup.gpQualifyingPoints}</p>
            </div>
        </div>
      </div>

      {/* Usage Stats Section */}
      <div className="rounded-lg p-6 ring-1 ring-pure-white/10">
        <h2 className="text-2xl font-bold mb-6 text-center flex items-center justify-center gap-3"><ProfileIcon className="w-6 h-6" /> Season Usage Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
                <h3 className="text-lg font-semibold text-primary-red mb-3 text-center">Class A Teams</h3>
                <div className="space-y-3">
                    {aTeams.map(t => <UsageMeter key={t.id} label={t.name} used={usageRollup.teams[t.id] || 0} limit={getLimit(EntityClass.A, 'teams')} />)}
                </div>
            </div>
             <div>
                <h3 className="text-lg font-semibold text-primary-red mb-3 text-center">Class B Teams</h3>
                <div className="space-y-3">
                    {bTeams.map(t => <UsageMeter key={t.id} label={t.name} used={usageRollup.teams[t.id] || 0} limit={getLimit(EntityClass.B, 'teams')} />)}
                </div>
            </div>
             <div>
                <h3 className="text-lg font-semibold text-primary-red mb-3 text-center">Class A Drivers</h3>
                <div className="space-y-3">
                    {aDrivers.map(d => <UsageMeter key={d.id} label={d.name} used={usageRollup.drivers[d.id] || 0} limit={getLimit(EntityClass.A, 'drivers')} />)}
                </div>
            </div>
             <div>
                <h3 className="text-lg font-semibold text-primary-red mb-3 text-center">Class B Drivers</h3>
                <div className="space-y-3">
                    {bDrivers.map(d => <UsageMeter key={d.id} label={d.name} used={usageRollup.drivers[d.id] || 0} limit={getLimit(EntityClass.B, 'drivers')} />)}
                </div>
            </div>
        </div>
      </div>
      
      {/* Picks History Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4 text-center">Picks & Points History</h2>
        <div className="space-y-2">
            {EVENTS.map(event => {
                const picks = seasonPicks[event.id];
                const results = raceResults[event.id];
                if (!picks) return null;

                const eventPoints = results ? calculatePointsForEvent(picks, results) : { totalPoints: 0, grandPrixPoints: 0, sprintPoints: 0, gpQualifyingPoints: 0, sprintQualifyingPoints: 0, fastestLapPoints: 0 };
                const isExpanded = expandedEvent === event.id;

                return (
                    <div key={event.id} className="rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                        <button className="w-full p-4 flex justify-between items-center cursor-pointer text-left" onClick={() => toggleEvent(event.id)}>
                            <div>
                                <h3 className="font-bold text-lg">R{event.round}: {event.name}</h3>
                                <p className="text-sm text-highlight-silver">{event.country}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-xl">{eventPoints.totalPoints} PTS</span>
                                <ChevronDownIcon className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                        </button>
                        {isExpanded && (
                             <div className="p-4 border-t border-accent-gray/50 text-sm">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   <div>
                                       <h4 className="font-bold text-primary-red mb-2">Teams</h4>
                                       <p>A: {getEntityName(picks.aTeams[0])}, {getEntityName(picks.aTeams[1])}</p>
                                       <p>B: {getEntityName(picks.bTeam)}</p>
                                   </div>
                                    <div>
                                       <h4 className="font-bold text-primary-red mb-2">Drivers</h4>
                                       <p>A: {getEntityName(picks.aDrivers[0])}, {getEntityName(picks.aDrivers[1])}, {getEntityName(picks.aDrivers[2])}</p>
                                       <p>B: {getEntityName(picks.bDrivers[0])}, {getEntityName(picks.bDrivers[1])}</p>
                                   </div>
                                    <div className="md:col-span-2">
                                       <h4 className="font-bold text-primary-red mb-2">Fastest Lap</h4>
                                       <p>{getEntityName(picks.fastestLap)}</p>
                                   </div>
                               </div>
                               {results && (
                                   <div className="mt-4 pt-4 border-t border-accent-gray/50">
                                       <h4 className="font-bold text-lg mb-2 text-center">Points Breakdown</h4>
                                       <div className="flex justify-around flex-wrap gap-4">
                                            <PointChip icon={CheckeredFlagIcon} label="GP Finish" points={eventPoints.grandPrixPoints} />
                                            {event.hasSprint && <PointChip icon={SprintIcon} label="Sprint" points={eventPoints.sprintPoints} />}
                                            <PointChip icon={PolePositionIcon} label="Quali" points={eventPoints.gpQualifyingPoints} />
                                            {event.hasSprint && results.sprintQualifying && <PointChip icon={SprintIcon} label="Sprint Quali" points={eventPoints.sprintQualifyingPoints} />}
                                            <PointChip icon={FastestLapIcon} label="Fastest Lap" points={eventPoints.fastestLapPoints} />
                                       </div>
                                   </div>
                               )}
                            </div>
                        )}
                    </div>
                );
            }).filter(Boolean)}
        </div>
      </div>
    </div>
  );
};

interface PointChipProps {
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    label: string;
    points?: number;
}
const PointChip: React.FC<PointChipProps> = ({ icon: Icon, label, points = 0 }) => (
    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-carbon-black/50 w-28">
        <Icon className="w-6 h-6 text-highlight-silver mb-1"/>
        <span className="text-xs text-highlight-silver">{label}</span>
        <span className="font-bold text-lg text-pure-white">{points}</span>
    </div>
);


export default ProfilePage;