import React, { useState, useEffect } from 'react';
import { User, PickSelection, RaceResults, PointsSystem, Driver, Constructor } from '../types.ts';
import { EVENTS } from '../constants.ts';
import { calculatePointsForEvent } from '../services/scoringService.ts';
import { updateUserProfile } from '../services/firestoreService.ts';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { ChevronDownIcon } from './icons/ChevronDownIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { BackIcon } from './icons/BackIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';

interface ProfilePageProps {
  user: User;
  seasonPicks: { [eventId: string]: PickSelection };
  raceResults: RaceResults;
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  setActivePage?: (page: any) => void;
  onUpdatePenalty?: (eventId: string, penalty: number, reason: string) => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ 
  user, 
  seasonPicks, 
  raceResults, 
  pointsSystem, 
  allDrivers, 
  allConstructors, 
  setActivePage,
  onUpdatePenalty 
}) => {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [isSaving, setIsSaving] = useState(false);
  
  // Admin State
  const [penalty, setPenalty] = useState<string>('0');
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
      setDisplayName(user.displayName);
  }, [user]);

  const handleSaveProfile = async () => {
      if (!displayName.trim()) return;
      setIsSaving(true);
      try {
          await updateUserProfile(user.id, { ...user, displayName });
          setIsEditing(false);
      } catch (e) {
          console.error(e);
          alert("Failed to update profile.");
      } finally {
          setIsSaving(false);
      }
  };
  
  const toggleEvent = (eventId: string) => {
      if (expandedEvent === eventId) {
          setExpandedEvent(null);
      } else {
          setExpandedEvent(eventId);
          if (onUpdatePenalty) {
              const picks = seasonPicks[eventId];
              setPenalty(picks?.penalty ? picks.penalty.toString() : '0');
              setReason(picks?.penaltyReason || '');
          }
      }
  };

  const handlePenaltySubmit = (eventId: string) => {
      if (onUpdatePenalty) {
          onUpdatePenalty(eventId, parseFloat(penalty), reason);
      }
  };

  const getEntityName = (id: string | null, type: 'driver' | 'team') => {
      if (!id) return 'Not Selected';
      if (type === 'driver') return allDrivers.find(d => d.id === id)?.name || id;
      return allConstructors.find(c => c.id === id)?.name || id;
  };
  
  const getEntityColor = (id: string | null, type: 'driver' | 'team') => {
      if (!id) return undefined;
      if (type === 'driver') {
           const d = allDrivers.find(d => d.id === id);
           return allConstructors.find(c => c.id === d?.constructorId)?.color;
      }
      return allConstructors.find(c => c.id === id)?.color;
  };

  const userTotalPoints = user.totalPoints !== undefined ? user.totalPoints : 0;
  const userRank = user.rank || '-';

  return (
    <div className="max-w-4xl mx-auto w-full text-pure-white">
        {/* Header with Navigation if activePage is provided */}
        {setActivePage && (
             <div className="mb-6">
                <button 
                    onClick={() => setActivePage('home')}
                    className="flex items-center gap-2 text-highlight-silver hover:text-pure-white transition-colors"
                >
                    <BackIcon className="w-5 h-5" />
                    Back to Home
                </button>
            </div>
        )}

        {/* Profile Card */}
        <div className="bg-accent-gray/50 backdrop-blur-sm rounded-xl p-6 md:p-8 mb-8 ring-1 ring-pure-white/10 flex flex-col md:flex-row gap-6 md:items-center">
            <div className="flex-shrink-0 flex justify-center md:justify-start">
                <div className="w-24 h-24 bg-carbon-black rounded-full flex items-center justify-center border-4 border-primary-red shadow-lg shadow-primary-red/20">
                     <F1CarIcon className="w-12 h-12 text-primary-red" />
                </div>
            </div>
            <div className="flex-grow text-center md:text-left space-y-2">
                {isEditing ? (
                    <div className="flex flex-col md:flex-row gap-2 items-center">
                        <input 
                            type="text" 
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="bg-carbon-black border border-accent-gray rounded px-3 py-2 text-pure-white font-bold text-xl focus:border-primary-red focus:outline-none"
                            placeholder="Display Name"
                        />
                        <div className="flex gap-2">
                            <button onClick={handleSaveProfile} disabled={isSaving} className="bg-green-600 px-3 py-2 rounded font-bold text-sm hover:opacity-90">{isSaving ? '...' : 'Save'}</button>
                            <button onClick={() => setIsEditing(false)} className="bg-carbon-black border border-accent-gray px-3 py-2 rounded font-bold text-sm hover:bg-pure-white/10">Cancel</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center md:justify-start gap-3">
                        <h1 className="text-3xl font-bold">{user.displayName}</h1>
                        {!onUpdatePenalty && ( // Only show edit if not in admin view
                            <button onClick={() => setIsEditing(true)} className="text-highlight-silver hover:text-primary-red transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M14.06,9L15,9.94L5.92,19H5V18.08L14.06,9M17.66,3C17.41,3 17.15,3.1 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18.17,3.09 17.92,3 17.66,3M14.06,6.19L3,17.25V21H6.75L17.81,9.94L14.06,6.19Z" /></svg>
                            </button>
                        )}
                    </div>
                )}
                <p className="text-highlight-silver font-mono text-sm">{user.email}</p>
                {user.duesPaidStatus === 'Unpaid' && !onUpdatePenalty && (
                     <div className="inline-block bg-primary-red/20 border border-primary-red/50 px-3 py-1 rounded text-xs font-bold text-primary-red uppercase mt-1">
                        Dues Unpaid
                     </div>
                )}
            </div>
            <div className="flex gap-4 justify-center md:justify-end">
                 <div className="text-center bg-carbon-black/50 p-4 rounded-lg border border-pure-white/5 min-w-[100px]">
                    <p className="text-xs text-highlight-silver uppercase tracking-wider mb-1">Rank</p>
                    <p className="text-3xl font-black text-primary-red">#{userRank}</p>
                 </div>
                 <div className="text-center bg-carbon-black/50 p-4 rounded-lg border border-pure-white/5 min-w-[100px]">
                    <p className="text-xs text-highlight-silver uppercase tracking-wider mb-1">Total Pts</p>
                    <p className="text-3xl font-black text-pure-white">{userTotalPoints}</p>
                 </div>
            </div>
        </div>

        {/* Season History */}
        <div className="space-y-4">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ProfileIcon className="w-6 h-6 text-primary-red" />
                Season Performance
            </h2>

            {EVENTS.map(event => {
                const picks = seasonPicks[event.id];
                const results = raceResults[event.id];
                const isLocked = false; // We can pass formLocks if needed, but history is read-only usually.
                
                // Calculate points if results exist
                const eventPoints = results 
                    ? calculatePointsForEvent(picks || { aTeams:[], bTeam:null, aDrivers:[], bDrivers:[], fastestLap:null }, results, pointsSystem, allDrivers)
                    : { totalPoints: 0, grandPrixPoints: 0, sprintPoints: 0, gpQualifyingPoints: 0, sprintQualifyingPoints: 0, fastestLapPoints: 0, penaltyPoints: 0 };
                
                const isExpanded = expandedEvent === event.id;
                const hasPenalty = (picks?.penalty || 0) > 0;
                const rawPoints = eventPoints.totalPoints + (eventPoints.penaltyPoints || 0);
                
                const hasPicks = !!picks;

                return (
                     <div key={event.id} className="bg-accent-gray/30 rounded-lg border border-pure-white/5 overflow-hidden transition-all">
                        {/* Event Header Card */}
                        <div 
                            onClick={() => toggleEvent(event.id)}
                            className={`p-4 flex items-center justify-between cursor-pointer hover:bg-pure-white/5 transition-colors relative overflow-hidden ${isExpanded ? 'bg-pure-white/5' : ''}`}
                        >
                            {/* Penalty Strip */}
                            {hasPenalty && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-red"></div>}
                            
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${hasPicks ? 'bg-primary-red text-pure-white' : 'bg-carbon-black text-highlight-silver border border-pure-white/10'}`}>
                                    {event.round}
                                </div>
                                <div>
                                    <h3 className="font-bold text-pure-white">{event.name}</h3>
                                    <p className="text-xs text-highlight-silver">{event.country}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                {results ? (
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-pure-white leading-none">{eventPoints.totalPoints}</p>
                                        <p className="text-[10px] text-highlight-silver uppercase tracking-wider">Points</p>
                                    </div>
                                ) : (
                                    <div className="text-right">
                                        <span className={`text-xs font-bold px-2 py-1 rounded uppercase ${hasPicks ? 'bg-green-600/20 text-green-400' : 'bg-highlight-silver/20 text-highlight-silver'}`}>
                                            {hasPicks ? 'Submitted' : 'No Picks'}
                                        </span>
                                    </div>
                                )}
                                <ChevronDownIcon className={`w-5 h-5 text-highlight-silver transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <div className="p-4 border-t border-pure-white/5 bg-carbon-black/20">
                                {hasPicks ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Picks Display */}
                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-2">Team Selections</h4>
                                                <div className="space-y-2">
                                                    {picks.aTeams.map((id, i) => (
                                                        <PickRow key={`at-${i}`} label="Class A" name={getEntityName(id, 'team')} color={getEntityColor(id, 'team')} icon={TeamIcon} />
                                                    ))}
                                                    <PickRow label="Class B" name={getEntityName(picks.bTeam, 'team')} color={getEntityColor(picks.bTeam, 'team')} icon={TeamIcon} />
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-highlight-silver uppercase mb-2">Driver Selections</h4>
                                                <div className="space-y-2">
                                                    {picks.aDrivers.map((id, i) => (
                                                        <PickRow key={`ad-${i}`} label="Class A" name={getEntityName(id, 'driver')} color={getEntityColor(id, 'driver')} icon={DriverIcon} />
                                                    ))}
                                                    {picks.bDrivers.map((id, i) => (
                                                        <PickRow key={`bd-${i}`} label="Class B" name={getEntityName(id, 'driver')} color={getEntityColor(id, 'driver')} icon={DriverIcon} />
                                                    ))}
                                                    <PickRow label="Fastest Lap" name={getEntityName(picks.fastestLap, 'driver')} color={getEntityColor(picks.fastestLap, 'driver')} icon={CheckeredFlagIcon} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Scoring Breakdown & Admin Controls */}
                                        <div className="flex flex-col gap-6">
                                            {results ? (
                                                <div className="bg-carbon-black/40 rounded-lg p-4">
                                                    <h4 className="text-xs font-bold text-highlight-silver uppercase mb-3">Points Breakdown</h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-highlight-silver">Race Finish</span>
                                                            <span className="font-bold text-pure-white">{eventPoints.grandPrixPoints}</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-highlight-silver">Qualifying</span>
                                                            <span className="font-bold text-pure-white">{eventPoints.gpQualifyingPoints + eventPoints.sprintQualifyingPoints}</span>
                                                        </div>
                                                        {event.hasSprint && (
                                                            <div className="flex justify-between">
                                                                <span className="text-highlight-silver">Sprint</span>
                                                                <span className="font-bold text-pure-white">{eventPoints.sprintPoints}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between">
                                                            <span className="text-highlight-silver">Fastest Lap</span>
                                                            <span className="font-bold text-pure-white">{eventPoints.fastestLapPoints}</span>
                                                        </div>
                                                        <div className="border-t border-pure-white/10 my-2"></div>
                                                        <div className="flex justify-between text-highlight-silver">
                                                            <span>Subtotal</span>
                                                            <span>{rawPoints}</span>
                                                        </div>
                                                        {hasPenalty && (
                                                            <div className="flex justify-between text-primary-red font-bold">
                                                                <span>Penalty ({(picks.penalty! * 100).toFixed(0)}%)</span>
                                                                <span>-{eventPoints.penaltyPoints}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex justify-between text-lg font-bold border-t border-pure-white/10 pt-2 mt-1">
                                                            <span className="text-pure-white">Total</span>
                                                            <span className="text-primary-red">{eventPoints.totalPoints}</span>
                                                        </div>
                                                        {hasPenalty && picks.penaltyReason && (
                                                            <p className="text-xs text-primary-red mt-2 italic">Reason: {picks.penaltyReason}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                 <div className="bg-carbon-black/40 rounded-lg p-4 text-center text-highlight-silver">
                                                    Results pending for this event.
                                                 </div>
                                            )}

                                            {/* Admin Penalty Controls */}
                                            {onUpdatePenalty && (
                                                <div className="bg-red-900/20 border border-primary-red/30 rounded-lg p-4">
                                                    <h4 className="text-xs font-bold text-primary-red uppercase mb-3 flex items-center gap-2">
                                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16" /></svg>
                                                        Admin: Apply Penalty
                                                    </h4>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="text-xs text-highlight-silver block mb-1">Penalty % (0.0 - 1.0)</label>
                                                            <input 
                                                                type="number" 
                                                                step="0.1"
                                                                min="0"
                                                                max="1"
                                                                value={penalty} 
                                                                onChange={(e) => setPenalty(e.target.value)}
                                                                className="w-full bg-carbon-black border border-accent-gray rounded px-2 py-1 text-pure-white text-sm"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-highlight-silver block mb-1">Reason</label>
                                                            <input 
                                                                type="text" 
                                                                value={reason} 
                                                                onChange={(e) => setReason(e.target.value)}
                                                                className="w-full bg-carbon-black border border-accent-gray rounded px-2 py-1 text-pure-white text-sm"
                                                                placeholder="e.g. Budget Cap Violation"
                                                            />
                                                        </div>
                                                        <button 
                                                            onClick={() => handlePenaltySubmit(event.id)}
                                                            className="w-full bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 rounded text-sm transition-colors"
                                                        >
                                                            Update Penalty
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-center text-highlight-silver italic">No picks submitted for this event.</p>
                                )}
                            </div>
                        )}
                     </div>
                );
            })}
        </div>
    </div>
  );
};

const PickRow: React.FC<{ label: string, name: string, color?: string, icon: React.FC<React.SVGProps<SVGSVGElement>> }> = ({ label, name, color, icon: Icon }) => (
    <div className="flex items-center justify-between bg-carbon-black/60 p-2 rounded border border-pure-white/5">
        <div className="flex items-center gap-3">
            <div className="p-1.5 rounded bg-pure-white/5">
                <Icon className="w-4 h-4 text-highlight-silver" />
            </div>
            <div>
                <p className="font-bold text-pure-white text-sm">{name}</p>
                <p className="text-[10px] text-highlight-silver uppercase">{label}</p>
            </div>
        </div>
        {color && <div className="w-2 h-8 rounded-full" style={{ backgroundColor: color }}></div>}
    </div>
);

export default ProfilePage;