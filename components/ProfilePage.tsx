
// Fix: Implement the ProfilePage component to display user stats and picks history.
import React, { useState } from 'react';
import { User, PickSelection, RaceResults, EntityClass, EventResult, PointsSystem, Driver, Constructor } from '../types.ts';
import useFantasyData from '../hooks/useFantasyData.ts';
import { calculatePointsForEvent } from '../services/scoringService.ts';
import { EVENTS } from '../constants.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';

interface ProfilePageProps {
  user: User;
  seasonPicks: { [eventId: string]: PickSelection };
  raceResults: RaceResults;
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
}

const getDriverPoints = (driverId: string | null, results: (string | null)[] | undefined, points: number[]) => {
  if (!driverId || !results) return 0;
  const pos = results.indexOf(driverId);
  return pos !== -1 ? (points[pos] || 0) : 0;
};

interface ModalData {
    title: string;
    content: React.ReactNode;
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

const ProfilePage: React.FC<ProfilePageProps> = ({ user, seasonPicks, raceResults, pointsSystem, allDrivers, allConstructors }) => {
  const { scoreRollup, usageRollup, getLimit } = useFantasyData(seasonPicks, raceResults, pointsSystem, allDrivers, allConstructors);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  
  // For Profile display, we can just show active ones in the breakdown to avoid clutter,
  // or we can show all if we want to show stats for retired drivers too. 
  // Let's show all for stats purposes.
  const aTeams = allConstructors.filter(c => c.class === EntityClass.A);
  const bTeams = allConstructors.filter(c => c.class === EntityClass.B);
  const aDrivers = allDrivers.filter(d => d.class === EntityClass.A);
  const bDrivers = allDrivers.filter(d => d.class === EntityClass.B);

  const toggleEvent = (eventId: string) => {
    setExpandedEvent(prev => (prev === eventId ? null : eventId));
  };
  
  const getEntityName = (id: string | null): string => {
    if (!id) return 'N/A';
    return allDrivers.find(d => d.id === id)?.name || allConstructors.find(c => c.id === id)?.name || 'Unknown';
  };

  const handleScoringDetailClick = (category: 'gp' | 'sprint' | 'quali' | 'fl') => {
    let title = '';
    const detailsContent: React.ReactNode[] = [];

    const relevantEvents = EVENTS.filter(e => seasonPicks[e.id] && raceResults[e.id]);

    if (relevantEvents.length === 0) {
        detailsContent.push(<p key="no-picks" className="text-highlight-silver">No picks submitted for completed events yet.</p>);
    } else {
        relevantEvents.forEach(event => {
            const picks = seasonPicks[event.id];
            const results = raceResults[event.id];
            const eventEntries: React.ReactNode[] = [];
            let pointSource: (string | null)[] | undefined;
            let pointSystemArr: number[];

            switch(category) {
                case 'gp':
                    title = 'Grand Prix Points Breakdown';
                    pointSource = results.grandPrixFinish;
                    pointSystemArr = pointsSystem.grandPrixFinish;
                    break;
                case 'sprint':
                    title = 'Sprint Race Points Breakdown';
                    pointSource = results.sprintFinish;
                    pointSystemArr = pointsSystem.sprintFinish;
                    if (!event.hasSprint) return;
                    break;
                case 'quali':
                    title = 'GP Qualifying Points Breakdown';
                    pointSource = results.gpQualifying;
                    pointSystemArr = pointsSystem.gpQualifying;
                    break;
                case 'fl':
                    title = 'Fastest Lap Points Breakdown';
                    break;
                default:
                    return;
            }

            if (category === 'fl') {
                if (picks.fastestLap) {
                    const points = (picks.fastestLap === results.fastestLap) ? pointsSystem.fastestLap : 0;
                    eventEntries.push(<li key="fl">{getEntityName(picks.fastestLap)}: <span className="font-semibold">{points} pts</span></li>);
                }
            } else if (pointSource && pointSystemArr) {
                const allPickedTeams = [...(picks.aTeams || []), picks.bTeam].filter(Boolean) as string[];
                const allPickedDrivers = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean) as string[];

                allPickedTeams.forEach(teamId => {
                    let teamPoints = 0;
                    // Resolve points using ALL drivers, not just active ones (historical)
                    allDrivers.forEach(driver => {
                        // Check against current config OR snapshot (snapshot logic is inside scoringService, here we mimic simple sum)
                        // Note: For pure UI breakdown, simplistic check might slightly differ from engine if driver swapped teams mid season without snapshot logic here.
                        // But Profile View is just an estimate breakdown.
                        if (driver.constructorId === teamId) {
                            teamPoints += getDriverPoints(driver.id, pointSource, pointSystemArr);
                        }
                    });
                    eventEntries.push(<li key={`team-${teamId}`}>{getEntityName(teamId)}: <span className="font-semibold">{teamPoints} pts</span></li>);
                });

                allPickedDrivers.forEach(driverId => {
                    const driverPoints = getDriverPoints(driverId, pointSource, pointSystemArr);
                    eventEntries.push(<li key={`driver-${driverId}`}>{getEntityName(driverId)}: <span className="font-semibold">{driverPoints} pts</span></li>);
                });
            }

            if (eventEntries.length > 0) {
                 detailsContent.push(
                    <div key={event.id}>
                        <h4 className="font-bold text-primary-red">{event.name}</h4>
                        <ul className="list-disc list-inside ml-2 text-ghost-white text-sm">
                            {eventEntries}
                        </ul>
                    </div>
                );
            }
        });
    }

    if (detailsContent.length === 0 || (detailsContent.length === 1 && (detailsContent[0] as any)?.key === 'no-picks')) {
        detailsContent.push(<p key="no-points" className="text-highlight-silver mt-4">No points scored in this category for any completed events.</p>);
    }

    setModalData({ title, content: <div className="space-y-4">{detailsContent}</div> });
  };

  const handleEventScoringDetailClick = (eventId: string, category: 'gp' | 'sprint' | 'quali' | 'fl') => {
    const event = EVENTS.find(e => e.id === eventId);
    const picks = seasonPicks[eventId];
    const results = raceResults[eventId];

    if (!event || !picks || !results) return;

    let title = '';
    const eventEntries: React.ReactNode[] = [];
    let pointSource: (string | null)[] | undefined;
    let pointSystemArr: number[];

    switch(category) {
        case 'gp':
            title = `${event.name} - GP Points`;
            pointSource = results.grandPrixFinish;
            pointSystemArr = pointsSystem.grandPrixFinish;
            break;
        case 'sprint':
            title = `${event.name} - Sprint Points`;
            pointSource = results.sprintFinish;
            pointSystemArr = pointsSystem.sprintFinish;
            break;
        case 'quali':
            title = `${event.name} - Quali Points`;
            pointSource = results.gpQualifying;
            pointSystemArr = pointsSystem.gpQualifying;
            break;
        case 'fl':
            title = `${event.name} - Fastest Lap`;
            break;
    }

    if (category === 'fl') {
        if (picks.fastestLap) {
            const points = (picks.fastestLap === results.fastestLap) ? pointsSystem.fastestLap : 0;
            eventEntries.push(<li key={`fl-${picks.fastestLap}`}>{getEntityName(picks.fastestLap)}: <span className="font-semibold">{points} pts</span></li>);
        }
    } else if (pointSource && pointSystemArr) {
        const allPickedTeams = [...(picks.aTeams || []), picks.bTeam].filter(Boolean) as string[];
        const allPickedDrivers = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean) as string[];

        allPickedTeams.forEach(teamId => {
            let teamPoints = 0;
            allDrivers.forEach(driver => {
                if (driver.constructorId === teamId) {
                    teamPoints += getDriverPoints(driver.id, pointSource, pointSystemArr);
                }
            });
            eventEntries.push(<li key={`team-${teamId}`}>{getEntityName(teamId)}: <span className="font-semibold">{teamPoints} pts</span></li>);
        });

        allPickedDrivers.forEach(driverId => {
            const driverPoints = getDriverPoints(driverId, pointSource, pointSystemArr);
            eventEntries.push(<li key={`driver-${driverId}`}>{getEntityName(driverId)}: <span className="font-semibold">{driverPoints} pts</span></li>);
        });
    }

    if (eventEntries.length === 0 || eventEntries.every(e => (e as any).props.children[2].props.children[0] === 0)) {
       eventEntries.push(<li key="no-points" className="text-highlight-silver">No points scored in this category.</li>);
    }
    
    const finalContent = <ul className="list-disc list-inside ml-2 text-ghost-white text-sm space-y-1">{eventEntries}</ul>

    setModalData({ title, content: finalContent });
  };


  return (
    <>
    <div className="max-w-7xl mx-auto text-pure-white space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-center mb-2">{user.displayName}</h1>
        <div className="flex flex-col justify-center items-center gap-2 mb-8">
            <p className="text-center text-xl text-highlight-silver">Total Points: <span className="font-bold text-pure-white">{scoreRollup.totalPoints}</span></p>
            <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${
                (user.duesPaidStatus || 'Unpaid') === 'Paid'
                ? 'bg-green-600/80 text-pure-white'
                : 'bg-primary-red/80 text-pure-white'
            }`}>
                Dues: {user.duesPaidStatus || 'Unpaid'}
            </span>
        </div>
      </div>

      {/* Scoring Breakdown Section */}
      <div className="rounded-lg p-6 ring-1 ring-pure-white/10">
        <h2 className="text-2xl font-bold mb-6 text-center">Scoring Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-4">
            <button onClick={() => handleScoringDetailClick('gp')} className="text-center p-2 rounded-lg hover:bg-pure-white/10 transition-colors duration-200">
                <CheckeredFlagIcon className="w-8 h-8 text-primary-red mb-2 mx-auto"/>
                <p className="text-sm text-highlight-silver">Grand Prix</p>
                <p className="font-bold text-2xl text-pure-white">{scoreRollup.grandPrixPoints}</p>
            </button>
            <button onClick={() => handleScoringDetailClick('sprint')} className="text-center p-2 rounded-lg hover:bg-pure-white/10 transition-colors duration-200">
                <SprintIcon className="w-8 h-8 text-primary-red mb-2 mx-auto"/>
                <p className="text-sm text-highlight-silver">Sprint Race</p>
                <p className="font-bold text-2xl text-pure-white">{scoreRollup.sprintPoints}</p>
            </button>
            <button onClick={() => handleScoringDetailClick('fl')} className="text-center p-2 rounded-lg hover:bg-pure-white/10 transition-colors duration-200">
                <FastestLapIcon className="w-8 h-8 text-primary-red mb-2 mx-auto"/>
                <p className="text-sm text-highlight-silver">Fastest Lap</p>
                <p className="font-bold text-2xl text-pure-white">{scoreRollup.fastestLapPoints}</p>
            </button>
            <button onClick={() => handleScoringDetailClick('quali')} className="text-center p-2 rounded-lg hover:bg-pure-white/10 transition-colors duration-200">
                <LeaderboardIcon className="w-8 h-8 text-primary-red mb-2 mx-auto"/>
                <p className="text-sm text-highlight-silver">GP Quali</p>
                <p className="font-bold text-2xl text-pure-white">{scoreRollup.gpQualifyingPoints}</p>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Selection Counts Section */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-center">Selection Counts</h2>
          <div className="rounded-lg p-6 ring-1 ring-pure-white/10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <CollapsibleUsageList
                  title="Class A Teams"
                  entities={aTeams}
                  usageData={usageRollup.teams}
                  limit={getLimit(EntityClass.A, 'teams')}
              />
              <CollapsibleUsageList
                  title="Class B Teams"
                  entities={bTeams}
                  usageData={usageRollup.teams}
                  limit={getLimit(EntityClass.B, 'teams')}
              />
              <CollapsibleUsageList
                  title="Class A Drivers"
                  entities={aDrivers}
                  usageData={usageRollup.drivers}
                  limit={getLimit(EntityClass.A, 'drivers')}
              />
              <CollapsibleUsageList
                  title="Class B Drivers"
                  entities={bDrivers}
                  usageData={usageRollup.drivers}
                  limit={getLimit(EntityClass.B, 'drivers')}
              />
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

                    const eventPoints = results ? calculatePointsForEvent(picks, results, pointsSystem, allDrivers) : { totalPoints: 0, grandPrixPoints: 0, sprintPoints: 0, gpQualifyingPoints: 0, sprintQualifyingPoints: 0, fastestLapPoints: 0 };
                    const isExpanded = expandedEvent === event.id;

                    return (
                        <div key={event.id} className="rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                            <button className="w-full p-4 flex justify-between items-center cursor-pointer text-left hover:bg-pure-white/5 transition-colors" onClick={() => toggleEvent(event.id)}>
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
                                                <button onClick={() => handleEventScoringDetailClick(event.id, 'gp')} className="transition-transform transform hover:scale-105">
                                                    <PointChip icon={CheckeredFlagIcon} label="GP Finish" points={eventPoints.grandPrixPoints} />
                                                </button>
                                                {event.hasSprint && (
                                                    <button onClick={() => handleEventScoringDetailClick(event.id, 'sprint')} className="transition-transform transform hover:scale-105">
                                                        <PointChip icon={SprintIcon} label="Sprint" points={eventPoints.sprintPoints} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleEventScoringDetailClick(event.id, 'quali')} className="transition-transform transform hover:scale-105">
                                                    <PointChip icon={PolePositionIcon} label="Quali" points={eventPoints.gpQualifyingPoints} />
                                                </button>
                                                {event.hasSprint && results.sprintQualifying && <PointChip icon={SprintIcon} label="Sprint Quali" points={eventPoints.sprintQualifyingPoints} />}
                                                <button onClick={() => handleEventScoringDetailClick(event.id, 'fl')} className="transition-transform transform hover:scale-105">
                                                    <PointChip icon={FastestLapIcon} label="Fastest Lap" points={eventPoints.fastestLapPoints} />
                                                </button>
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
    </div>
    {modalData && (
        <div className="fixed inset-0 bg-carbon-black/80 flex items-center justify-center z-50 p-4" onClick={() => setModalData(null)}>
            <div className="bg-accent-gray rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto ring-1 ring-pure-white/20 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-2xl font-bold text-pure-white">{modalData.title}</h3>
                         <button onClick={() => setModalData(null)} className="text-highlight-silver hover:text-pure-white text-3xl leading-none">&times;</button>
                    </div>
                    {modalData.content}
                </div>
            </div>
        </div>
    )}
    </>
  );
};

interface PointChipProps {
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
    label: string;
    points?: number;
}
const PointChip: React.FC<PointChipProps> = ({ icon: Icon, label, points = 0 }) => (
    <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-carbon-black/50 w-28 h-full">
        <Icon className="w-6 h-6 text-highlight-silver mb-1"/>
        <span className="text-xs text-highlight-silver">{label}</span>
        <span className="font-bold text-lg text-pure-white">{points}</span>
    </div>
);

const CollapsibleUsageList: React.FC<{
  title: string;
  entities: { id: string; name: string }[];
  usageData: { [id: string]: number };
  limit: number;
}> = ({ title, entities, usageData, limit }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left py-2 px-2 rounded-md hover:bg-pure-white/5"
        aria-expanded={isOpen}
      >
        <h3 className="text-lg font-semibold text-primary-red">{title}</h3>
        <ChevronDownIcon className={`w-6 h-6 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="mt-3 space-y-3 flex-grow">
          {entities.map(e => (
            <UsageMeter
              key={e.id}
              label={e.name}
              used={usageData[e.id] || 0}
              limit={limit}
            />
          ))}
        </div>
      )}
    </div>
  );
};


export default ProfilePage;
