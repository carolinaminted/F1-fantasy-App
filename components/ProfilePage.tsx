
import React, { useState, useEffect } from 'react';
import { User, PickSelection, RaceResults, EntityClass, EventResult, PointsSystem, Driver, Constructor } from '../types.ts';
import useFantasyData from '../hooks/useFantasyData.ts';
import { calculatePointsForEvent } from '../services/scoringService.ts';
import { EVENTS, CONSTRUCTORS } from '../constants.ts';
import { updateUserProfile } from '../services/firestoreService.ts';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from './icons/SprintIcon.tsx';
import { PolePositionIcon } from './icons/PolePositionIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { AdminIcon } from './icons/AdminIcon.tsx';
import type { Page } from '../App.tsx';

interface ProfilePageProps {
  user: User;
  seasonPicks: { [eventId: string]: PickSelection };
  raceResults: RaceResults;
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  setActivePage?: (page: Page) => void;
  // New Prop: If present, enables penalty management UI
  onUpdatePenalty?: (eventId: string, penalty: number, reason: string) => Promise<void>;
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

const UsageMeter: React.FC<{ label: string; used: number; limit: number; color?: string }> = ({ label, used, limit, color }) => {
  const percentage = limit > 0 ? (used / limit) * 100 : 0;
  const barColor = color || '#DA291C';

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
            {color && <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: color }} />}
            <span className="text-sm font-semibold text-ghost-white">{label}</span>
        </div>
        <span className="text-sm font-mono text-highlight-silver">{used} / {limit}</span>
      </div>
      <div className="w-full bg-carbon-black rounded-full h-2.5 ring-1 ring-pure-white/5 overflow-hidden">
        <div 
          className="h-2.5 rounded-full transition-all duration-500 relative" 
          style={{ width: `${percentage}%`, backgroundColor: barColor }}
        >
             <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
        </div>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{ icon: any, label: string, value: string }> = ({ icon: Icon, label, value }) => (
    <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-carbon-black/50 w-full h-full min-h-[120px] ring-1 ring-pure-white/5 hover:bg-pure-white/5 transition-all duration-200">
        <Icon className="w-8 h-8 text-primary-red mb-3" />
        <span className="text-xs font-bold uppercase text-highlight-silver mb-1">{label}</span>
        <span className="font-bold text-lg text-pure-white text-center break-words w-full px-2 leading-tight">{value}</span>
    </div>
);

// Admin Penalty Control Component
const PenaltyManager: React.FC<{ 
    eventId: string; 
    currentPenalty: number; 
    currentReason?: string;
    onSave: (eventId: string, penalty: number, reason: string) => Promise<void>; 
}> = ({ eventId, currentPenalty, currentReason, onSave }) => {
    const [penaltyPercent, setPenaltyPercent] = useState(currentPenalty * 100);
    const [reason, setReason] = useState(currentReason || '');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(eventId, penaltyPercent / 100, reason);
        setIsSaving(false);
    };

    return (
        <div className="mt-4 p-4 bg-red-900/20 border border-primary-red/30 rounded-lg">
            <h4 className="flex items-center gap-2 text-sm font-bold text-primary-red uppercase mb-3">
                <AdminIcon className="w-4 h-4" /> Admin Penalty Tribunal
            </h4>
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-bold text-highlight-silver mb-1">Penalty Deduction (%)</label>
                    <div className="flex items-center gap-3">
                        <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={penaltyPercent}
                            onChange={(e) => setPenaltyPercent(Number(e.target.value))}
                            className="flex-1 accent-primary-red"
                        />
                        <span className="font-mono font-bold text-pure-white w-12 text-right">{penaltyPercent}%</span>
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-highlight-silver mb-1">Reason / Infraction</label>
                    <input 
                        type="text" 
                        value={reason} 
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Late Submission"
                        className="w-full bg-carbon-black border border-accent-gray rounded px-2 py-1 text-sm text-pure-white"
                    />
                </div>
                <button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    className="w-full bg-primary-red hover:opacity-90 text-pure-white font-bold py-1.5 px-4 rounded text-xs transition-colors disabled:opacity-50"
                >
                    {isSaving ? 'Applying Penalty...' : 'Apply Penalty Judgment'}
                </button>
            </div>
        </div>
    );
};

const ProfilePage: React.FC<ProfilePageProps> = ({ user, seasonPicks, raceResults, pointsSystem, allDrivers, allConstructors, setActivePage, onUpdatePenalty }) => {
  const { scoreRollup, usageRollup, getLimit } = useFantasyData(seasonPicks, raceResults, pointsSystem, allDrivers, allConstructors);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [modalData, setModalData] = useState<ModalData | null>(null);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ 
      displayName: user.displayName, 
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '' 
  });
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    // Update local state if user prop changes (e.g. external update)
    if (!isEditingProfile) {
        setProfileForm({ 
            displayName: user.displayName, 
            email: user.email,
            firstName: user.firstName || '',
            lastName: user.lastName || ''
        });
    }
  }, [user, isEditingProfile]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    // Basic Validation
    if (!profileForm.firstName.trim()) {
        setProfileError("First name is required.");
        return;
    }
    if (!profileForm.lastName.trim()) {
        setProfileError("Last name is required.");
        return;
    }
    if (!profileForm.displayName.trim()) {
        setProfileError("Display name cannot be empty.");
        return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profileForm.email)) {
        setProfileError("Please enter a valid email address.");
        return;
    }

    setIsSavingProfile(true);
    try {
        await updateUserProfile(user.id, {
            displayName: profileForm.displayName,
            email: profileForm.email,
            firstName: profileForm.firstName,
            lastName: profileForm.lastName
        });
        setIsEditingProfile(false);
    } catch (error) {
        console.error(error);
        setProfileError("Failed to update profile. Please try again.");
    } finally {
        setIsSavingProfile(false);
    }
  };
  
  // For Profile display, we can just show active ones in the breakdown to avoid clutter,
  // or we can show all if we want to show stats for retired drivers too. 
  // Let's show all for stats purposes.
  const aTeams = allConstructors.filter(c => c.class === EntityClass.A);
  const bTeams = allConstructors.filter(c => c.class === EntityClass.B);
  const aDrivers = allDrivers.filter(d => d.class === EntityClass.A);
  const bDrivers = allDrivers.filter(d => d.class === EntityClass.B);

  // Helper to resolve team color safely (DB vs Constants)
  const getTeamColor = (teamId: string | undefined) => {
      if (!teamId) return undefined;
      // Try dynamic list first (if user updated colors in Admin)
      const dynamicTeam = allConstructors.find(c => c.id === teamId);
      if (dynamicTeam?.color) return dynamicTeam.color;
      // Fallback to constants
      return CONSTRUCTORS.find(c => c.id === teamId)?.color;
  };

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

  const handleUsageDetailClick = (entityId: string, entityName: string) => {
    const usageEvents = EVENTS.filter(event => {
        const picks = seasonPicks[event.id];
        if (!picks) return false;
        
        // Check if entityId is in any of the pick arrays
        const allPicked = [
            ...picks.aTeams, 
            picks.bTeam, 
            ...picks.aDrivers, 
            ...picks.bDrivers
        ].filter(Boolean); // Filter nulls
        
        return allPicked.includes(entityId);
    });
    
    const content = (
        <div className="space-y-4">
             <p className="text-highlight-silver text-sm">You have selected <span className="text-pure-white font-bold">{entityName}</span> for the following events:</p>
             {usageEvents.length > 0 ? (
                <ul className="space-y-2">
                    {usageEvents.map(e => (
                        <li key={e.id} className="p-3 bg-carbon-black/50 rounded flex justify-between items-center border border-pure-white/5">
                            <span className="font-semibold text-ghost-white">R{e.round}: {e.name}</span>
                            <span className="text-xs text-highlight-silver">{e.country}</span>
                        </li>
                    ))}
                </ul>
             ) : (
                 <div className="p-4 text-center bg-carbon-black/30 rounded border border-dashed border-accent-gray">
                     <p className="text-highlight-silver">No selections made yet.</p>
                 </div>
             )}
        </div>
    );
    
    setModalData({ title: `Usage History: ${entityName}`, content });
  };


  return (
    <>
    <div className="max-w-7xl mx-auto text-pure-white space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-center mb-2">{user.displayName}</h1>
        <div className="flex flex-col justify-center items-center gap-2 mb-8">
            <p className="text-center text-xl text-highlight-silver">Total Points: <span className="font-bold text-pure-white">{scoreRollup.totalPoints}</span></p>
            <button 
                onClick={() => setActivePage && setActivePage('duesPayment')}
                disabled={!setActivePage}
                className={`px-3 py-1 text-xs font-bold uppercase rounded-full transition-transform hover:scale-105 ${
                    (user.duesPaidStatus || 'Unpaid') === 'Paid'
                    ? 'bg-green-600/80 text-pure-white'
                    : 'bg-primary-red/80 text-pure-white'
                } ${setActivePage ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
            >
                Dues: {user.duesPaidStatus || 'Unpaid'}
            </button>
        </div>
      </div>

      {/* Profile Info Section */}
      <div className="rounded-lg p-6 ring-1 ring-pure-white/10 relative">
        <div className="flex flex-col items-center justify-center mb-6">
            <h2 className="text-2xl font-bold text-center mb-2">Profile Information</h2>
            {!isEditingProfile && setActivePage && (
                <button 
                    onClick={() => setIsEditingProfile(true)}
                    className="text-lg text-primary-red hover:text-pure-white font-bold transition-colors"
                >
                    Edit Details
                </button>
            )}
        </div>
        
        {isEditingProfile ? (
            <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-lg mx-auto bg-accent-gray/50 backdrop-blur-sm p-6 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">First Name</label>
                        <input 
                            type="text" 
                            value={profileForm.firstName} 
                            onChange={e => setProfileForm(prev => ({...prev, firstName: e.target.value}))}
                            placeholder="Required"
                            required
                            className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white focus:border-primary-red focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Last Name</label>
                        <input 
                            type="text" 
                            value={profileForm.lastName} 
                            onChange={e => setProfileForm(prev => ({...prev, lastName: e.target.value}))}
                            placeholder="Required"
                            required
                            className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white focus:border-primary-red focus:outline-none"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Display Name</label>
                    <input 
                        type="text" 
                        value={profileForm.displayName} 
                        onChange={e => setProfileForm(prev => ({...prev, displayName: e.target.value}))}
                        required
                        className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white focus:border-primary-red focus:outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-highlight-silver mb-1">Email Address</label>
                    <input 
                        type="email" 
                        value={profileForm.email} 
                        onChange={e => setProfileForm(prev => ({...prev, email: e.target.value}))}
                        required
                        className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white focus:border-primary-red focus:outline-none"
                    />
                </div>
                {profileError && <p className="text-primary-red text-sm text-center">{profileError}</p>}
                
                <div className="flex gap-3 pt-2 justify-center">
                    <button 
                        type="button" 
                        onClick={() => {
                            setIsEditingProfile(false); 
                            setProfileForm({ 
                                displayName: user.displayName, 
                                email: user.email,
                                firstName: user.firstName || '',
                                lastName: user.lastName || ''
                            });
                            setProfileError(null);
                        }}
                        className="px-4 py-2 text-sm font-bold text-highlight-silver hover:text-pure-white bg-transparent border border-accent-gray rounded hover:border-highlight-silver transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        disabled={isSavingProfile}
                        className="px-4 py-2 text-sm font-bold text-pure-white bg-primary-red hover:bg-red-600 rounded transition-colors disabled:opacity-50"
                    >
                        {isSavingProfile ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <InfoCard icon={F1CarIcon} label="Team Name" value={user.displayName} />
                <InfoCard icon={DriverIcon} label="First Name" value={user.firstName || '-'} />
                <InfoCard icon={DriverIcon} label="Last Name" value={user.lastName || '-'} />
                <InfoCard icon={ProfileIcon} label="Email" value={user.email} />
            </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Scoring Breakdown & Selection Counts */}
        <div className="space-y-8">
            
            {/* Scoring Breakdown Section */}
            <div>
                <h2 className="text-2xl font-bold mb-4 text-center">Scoring Breakdown</h2>
                <div className="rounded-lg p-6 ring-1 ring-pure-white/10">
                    <div className="grid grid-cols-2 gap-4">
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
            </div>

            {/* Selection Counts Section */}
            <div>
            <h2 className="text-2xl font-bold mb-4 text-center">Selection Counts</h2>
            <div className="rounded-lg p-6 ring-1 ring-pure-white/10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                <CollapsibleUsageList
                    title="Class A Teams"
                    entities={aTeams.map(t => ({ id: t.id, name: t.name, color: getTeamColor(t.id) }))}
                    usageData={usageRollup.teams}
                    limit={getLimit(EntityClass.A, 'teams')}
                    onItemClick={handleUsageDetailClick}
                />
                <CollapsibleUsageList
                    title="Class B Teams"
                    entities={bTeams.map(t => ({ id: t.id, name: t.name, color: getTeamColor(t.id) }))}
                    usageData={usageRollup.teams}
                    limit={getLimit(EntityClass.B, 'teams')}
                    onItemClick={handleUsageDetailClick}
                />
                <CollapsibleUsageList
                    title="Class A Drivers"
                    entities={aDrivers.map(d => {
                        return { id: d.id, name: d.name, color: getTeamColor(d.constructorId) };
                    })}
                    usageData={usageRollup.drivers}
                    limit={getLimit(EntityClass.A, 'drivers')}
                    onItemClick={handleUsageDetailClick}
                />
                <CollapsibleUsageList
                    title="Class B Drivers"
                    entities={bDrivers.map(d => {
                        return { id: d.id, name: d.name, color: getTeamColor(d.constructorId) };
                    })}
                    usageData={usageRollup.drivers}
                    limit={getLimit(EntityClass.B, 'drivers')}
                    onItemClick={handleUsageDetailClick}
                />
                </div>
            </div>
            </div>
        </div>

        {/* Right Column: Picks History Section */}
        <div>
            <h2 className="text-2xl font-bold mb-4 text-center">Picks & Points History</h2>
            <div className="space-y-2">
                {EVENTS.map(event => {
                    const picks = seasonPicks[event.id];
                    const results = raceResults[event.id];
                    if (!picks) return null;

                    const eventPoints = results ? calculatePointsForEvent(picks, results, pointsSystem, allDrivers) : { totalPoints: 0, grandPrixPoints: 0, sprintPoints: 0, gpQualifyingPoints: 0, sprintQualifyingPoints: 0, fastestLapPoints: 0, penaltyPoints: 0 };
                    const isExpanded = expandedEvent === event.id;
                    const hasPenalty = picks.penalty && picks.penalty > 0;
                    
                    // Net points calculation for display
                    const rawPoints = eventPoints.totalPoints + (eventPoints.penaltyPoints || 0);

                    return (
                        <div key={event.id} className="relative rounded-lg ring-1 ring-pure-white/10 overflow-hidden">
                             {/* Penalty Badge Overlay */}
                             {hasPenalty && (
                                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 -rotate-6 border-4 border-red-500 text-red-500 font-black text-xl px-4 py-1 opacity-80 pointer-events-none z-10 whitespace-nowrap">
                                    PENALTY APPLIED (-{(picks.penalty! * 100).toFixed(0)}%)
                                </div>
                            )}

                            <button className={`w-full p-4 flex justify-between items-center cursor-pointer text-left hover:bg-pure-white/5 transition-colors ${hasPenalty ? 'bg-red-900/10' : ''}`} onClick={() => toggleEvent(event.id)}>
                                <div>
                                    <h3 className="font-bold text-lg">R{event.round}: {event.name}</h3>
                                    <p className="text-sm text-highlight-silver">{event.country}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-right">
                                        <span className="font-bold text-xl block">{eventPoints.totalPoints} PTS</span>
                                        {hasPenalty && <span className="text-xs text-red-400 block font-bold">Adjusted</span>}
                                    </div>
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
                                        <div className="flex justify-around flex-wrap gap-4 mb-4">
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
                                        
                                        {/* Penalty Breakdown Display */}
                                        {hasPenalty && (
                                            <div className="bg-red-900/20 border border-red-500/30 p-3 rounded-lg text-center mb-4">
                                                <p className="text-highlight-silver text-xs uppercase font-bold mb-1">Score Adjustment</p>
                                                <div className="flex justify-center items-center gap-2 text-sm">
                                                    <span>{rawPoints} (Raw)</span>
                                                    <span>-</span>
                                                    <span className="text-red-400 font-bold">{eventPoints.penaltyPoints} (Penalty)</span>
                                                    <span>=</span>
                                                    <span className="text-pure-white font-bold">{eventPoints.totalPoints} Pts</span>
                                                </div>
                                                {picks.penaltyReason && <p className="text-xs text-red-300 mt-1 italic">"{picks.penaltyReason}"</p>}
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                {/* Admin Controls (Only visible if prop provided) */}
                                {onUpdatePenalty && (
                                    <PenaltyManager 
                                        eventId={event.id} 
                                        currentPenalty={picks.penalty || 0}
                                        currentReason={picks.penaltyReason}
                                        onSave={onUpdatePenalty}
                                    />
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
  entities: { id: string; name: string; color?: string }[];
  usageData: { [id: string]: number };
  limit: number;
  onItemClick: (id: string, name: string) => void;
}> = ({ title, entities, usageData, limit, onItemClick }) => {
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
            <button
                key={e.id}
                onClick={() => onItemClick(e.id, e.name)}
                className="w-full text-left transition-transform hover:scale-[1.01] hover:bg-pure-white/5 rounded-lg p-1.5 -mx-1.5 focus:outline-none focus:ring-1 focus:ring-pure-white/20 group"
            >
                <UsageMeter
                  label={e.name}
                  used={usageData[e.id] || 0}
                  limit={limit}
                  color={e.color}
                />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


export default ProfilePage;
