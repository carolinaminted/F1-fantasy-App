import React, { useState, useEffect } from 'react';
import { User, PickSelection, RaceResults, EntityClass, EventResult, PointsSystem, Driver, Constructor, Event } from '../types.ts';
import useFantasyData from '../hooks/useFantasyData.ts';
import { calculateScoreRollup, calculatePointsForEvent } from '../services/scoringService.ts';
import { CONSTRUCTORS, CURRENT_SEASON } from '../constants.ts';
import { updateUserProfile, getAllUsersAndPicks } from '../services/firestoreService.ts';
import { db, auth, functions } from '../services/firebase.ts';
import { validateDisplayName, validateRealName, sanitizeString } from '../services/validation.ts';
import { doc, getDoc } from '@firebase/firestore';
import { httpsCallable } from '@firebase/functions';
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
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { PicksIcon } from './icons/PicksIcon.tsx';
import { PageHeader } from './ui/PageHeader.tsx';
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
  events: Event[];
  isPublicView?: boolean;
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
  const isMaxed = limit > 0 && used >= limit;

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
            {color && <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: color }} />}
            <span className={`text-sm font-semibold transition-all ${isMaxed ? 'text-highlight-silver line-through opacity-70' : 'text-ghost-white'}`}>{label}</span>
        </div>
        <span className={`text-sm font-mono ${isMaxed ? 'text-primary-red font-bold' : 'text-highlight-silver'}`}>{used} / {limit}</span>
      </div>
      <div className="w-full bg-carbon-black rounded-full h-2.5 ring-1 ring-pure-white/5 overflow-hidden">
        <div 
          className="h-2.5 rounded-full transition-all duration-500 relative" 
          style={{ width: `${percentage}%`, backgroundColor: barColor, opacity: isMaxed ? 0.6 : 1 }}
        >
             <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
        </div>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{ icon: any, label: string, value: string }> = ({ icon: Icon, label, value }) => (
    <div className="flex flex-col items-center justify-center p-6 rounded-lg bg-black/20 w-full h-full min-h-[120px] border border-pure-white/5 shadow-inner">
        <Icon className="w-8 h-8 text-primary-red mb-3 opacity-80" />
        <span className="text-xs font-bold uppercase text-highlight-silver mb-2 tracking-widest">{label}</span>
        <span className="text-xl md:text-2xl font-black text-pure-white text-center break-words w-full px-2 leading-tight">{value}</span>
    </div>
);

// Admin Penalty Control Component
const PenaltyManager: React.FC<{ 
    eventId: string; 
    currentPenalty: number; 
    currentReason?: string;
    onSave: (eventId: string, penalty: number, reason: string) => Promise<void>; 
}> = ({ eventId, currentPenalty, currentReason, onSave }) => {
    // Initialize with prop but keep local state for editing
    const [penaltyPercent, setPenaltyPercent] = useState<string | number>(currentPenalty * 100);
    const [reason, setReason] = useState(currentReason || '');
    const [isSaving, setIsSaving] = useState(false);

    // Sync local state if props change (e.g. parent refresh or navigating between events)
    useEffect(() => {
        setPenaltyPercent(currentPenalty * 100);
        setReason(currentReason || '');
    }, [currentPenalty, currentReason]);

    const handleSave = async () => {
        setIsSaving(true);
        const val = Number(penaltyPercent);
        const finalPercent = isNaN(val) ? 0 : val;
        await onSave(eventId, finalPercent / 100, reason);
        setIsSaving(false);
    };

    const handleClear = async () => {
        if (!window.confirm("Clear this penalty?")) return;
        setIsSaving(true);
        setPenaltyPercent(0);
        setReason('');
        await onSave(eventId, 0, '');
        setIsSaving(false);
    };

    return (
        <div className="mt-4 p-4 bg-red-900/20 border border-primary-red/30 rounded-lg">
            <div className="flex justify-between items-center mb-3">
                <h4 className="flex items-center gap-2 text-sm font-bold text-primary-red uppercase">
                    <AdminIcon className="w-4 h-4" /> Admin Penalty Tribunal
                </h4>
                <div className="flex items-center gap-2">
                    <label className="text-[10px] uppercase font-bold text-highlight-silver hidden sm:block">Deduction</label>
                    <div className="flex items-center gap-1 bg-carbon-black border border-accent-gray rounded px-2 py-1 focus-within:border-primary-red transition-colors">
                        <input 
                            type="number" 
                            min="0" 
                            max="100" 
                            value={penaltyPercent}
                            onChange={(e) => setPenaltyPercent(e.target.value)}
                            className="w-10 bg-transparent text-sm text-pure-white font-mono focus:outline-none text-right"
                        />
                        <span className="font-bold text-highlight-silver text-xs">%</span>
                    </div>
                </div>
            </div>
            
            <div className="space-y-3">
                <div>
                    <label className="block text-xs font-bold text-highlight-silver mb-1">Reason / Infraction</label>
                    <input 
                        type="text" 
                        value={reason} 
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Late Submission"
                        className="w-full bg-carbon-black border border-accent-gray rounded px-2 py-1.5 text-sm text-pure-white focus:border-primary-red focus:outline-none"
                    />
                </div>
                <div className="flex gap-2 pt-1">
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="flex-1 bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-4 rounded text-xs transition-colors disabled:opacity-50 shadow-lg shadow-primary-red/20"
                    >
                        {isSaving ? 'Applying...' : 'Apply Penalty Judgment'}
                    </button>
                    <button 
                        onClick={handleClear}
                        disabled={isSaving}
                        className="bg-green-600 hover:bg-green-500 text-pure-white font-bold py-2 px-4 rounded text-xs transition-colors disabled:opacity-50 shadow-lg shadow-green-600/20"
                        type="button"
                    >
                        Clear Penalty
                    </button>
                </div>
            </div>
        </div>
    );
};

const ProfilePage: React.FC<ProfilePageProps> = ({ user, seasonPicks, raceResults, pointsSystem, allDrivers, allConstructors, setActivePage, onUpdatePenalty, events, isPublicView = false }) => {
  const { scoreRollup, usageRollup, getLimit } = useFantasyData(seasonPicks, raceResults, pointsSystem, allDrivers, allConstructors);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [globalRank, setGlobalRank] = useState<number | null>(null);

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

  // Password Reset State
  const [resetCooldown, setResetCooldown] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  // Fetch Global Rank with Fallback
  useEffect(() => {
      const fetchRank = async () => {
          let rankFound = null;

          // 1. Try fetching from public profile (fastest, pre-calculated by Cloud Function)
          try {
              const publicRef = doc(db, 'public_users', user.id);
              const snap = await getDoc(publicRef);
              if (snap.exists() && snap.data().rank) {
                  rankFound = snap.data().rank;
              }
          } catch (e) {
              console.warn("Failed to fetch global rank from public profile", e);
          }

          if (rankFound) {
              setGlobalRank(rankFound);
              return;
          }

          // 2. Fallback: Client-side Calculation (ensure consistency with Dashboard)
          try {
              // Fetch all data necessary for ranking
              const { users: allUsersList, allPicks } = await getAllUsersAndPicks();
              
              // Filter users similar to Leaderboard logic (exclude admin fallback user if present)
              const validUsers = allUsersList.filter(u => u.displayName !== 'Admin Principal');

              // Calculate points for everyone
              const scores = validUsers.map(u => {
                  // Use pre-calculated if available in public_users doc
                  if (u.totalPoints !== undefined) {
                      return { uid: u.id, points: u.totalPoints };
                  }
                  
                  // Calculate from raw picks
                  const userPicks = allPicks[u.id] || {};
                  // Use the props passed to ProfilePage for the calculation context (live rules)
                  const scoreData = calculateScoreRollup(userPicks, raceResults, pointsSystem, allDrivers);
                  return { uid: u.id, points: scoreData.totalPoints };
              });

              // Sort descending
              scores.sort((a, b) => b.points - a.points);

              // Find current user's index
              const index = scores.findIndex(s => s.uid === user.id);
              if (index !== -1) {
                  setGlobalRank(index + 1);
              }
          } catch (e) {
              console.error("Failed to calculate fallback rank", e);
          }
      };

      // If user object already has rank (from passed prop if available), use it, otherwise fetch/calc
      if (user.rank) {
          setGlobalRank(user.rank);
      } else {
          fetchRank();
      }
  }, [user.id, user.rank, raceResults, pointsSystem, allDrivers]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);

    const fnValidation = validateRealName(profileForm.firstName, "First Name");
    if (!fnValidation.valid) return setProfileError(fnValidation.error!);

    const lnValidation = validateRealName(profileForm.lastName, "Last Name");
    if (!lnValidation.valid) return setProfileError(lnValidation.error!);

    const dnValidation = validateDisplayName(profileForm.displayName);
    if (!dnValidation.valid) return setProfileError(dnValidation.error!);

    // Since email is now read-only, we don't need to re-validate it here for the payload, 
    // but the backend update function still expects it in some flows.
    const cleanFirstName = sanitizeString(profileForm.firstName);
    const cleanLastName = sanitizeString(profileForm.lastName);
    const cleanDisplayName = sanitizeString(profileForm.displayName);

    setIsSavingProfile(true);
    try {
        await updateUserProfile(user.id, {
            displayName: cleanDisplayName,
            email: profileForm.email, // Kept for safety, though read-only in UI
            firstName: cleanFirstName,
            lastName: cleanLastName
        });
        setIsEditingProfile(false);
    } catch (error) {
        console.error(error);
        setProfileError("Failed to update profile. Please try again.");
    } finally {
        setIsSavingProfile(false);
    }
  };

  const handlePasswordReset = async () => {
      if (resetCooldown) return;
      setResetStatus(null);
      
      try {
          const sendResetLink = httpsCallable(functions, 'sendPasswordResetLink');
          await sendResetLink({ email: user.email });
          setResetStatus({ type: 'success', message: `Password reset link sent to ${user.email}` });
          setResetCooldown(true);
          setTimeout(() => setResetCooldown(false), 60000);
      } catch (err: any) {
          console.error("Password reset error:", err);
          if (err.code === 'functions/resource-exhausted') {
              setResetStatus({ type: 'error', message: 'Too many attempts. Please wait a few minutes.' });
          } else {
              setResetStatus({ type: 'error', message: 'Failed to send reset email. Please try again later.' });
          }
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

  // Logic for Dues Button Click
  const handleDuesClick = () => {
      if (isPublicView) return; // Disable for public view
      if (user.duesPaidStatus === 'Paid') {
          setModalData({
              title: "Season Status",
              content: (
                  <div className="text-center py-6">
                      <div className="bg-green-600/20 p-4 rounded-full inline-block mb-4">
                          <CheckeredFlagIcon className="w-12 h-12 text-green-500" />
                      </div>
                      <h3 className="text-xl font-bold text-pure-white mb-2">All Set!</h3>
                      <p className="text-highlight-silver">
                          Thank you for paying your dues. Enjoy the season and good luck!
                      </p>
                      <button 
                        onClick={() => setModalData(null)}
                        className="mt-6 bg-green-600 hover:bg-green-500 text-pure-white font-bold py-2 px-6 rounded-lg w-full"
                      >
                          Close
                      </button>
                  </div>
              )
          });
      } else {
          // Navigate to Payment page
          if (setActivePage) setActivePage('duesPayment');
      }
  };

  const handleScoringDetailClick = (category: 'gp' | 'sprint' | 'quali' | 'fl') => {
    let title = '';
    const detailsContent: React.ReactNode[] = [];

    const relevantEvents = events.filter(e => seasonPicks[e.id] && raceResults[e.id]);

    if (relevantEvents.length === 0) {
        detailsContent.push(<p key="no-picks" className="text-highlight-silver text-center">No picks submitted for completed events yet.</p>);
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

            if (eventEntries.length > 0) {
                 detailsContent.push(
                    <div key={event.id} className="text-center">
                        <h4 className="font-bold text-primary-red mb-2">{event.name}</h4>
                        <ul className="list-none space-y-1 text-ghost-white text-sm">
                            {eventEntries}
                        </ul>
                    </div>
                );
            }
        });
    }

    if (detailsContent.length === 0 || (detailsContent.length === 1 && (detailsContent[0] as any)?.key === 'no-picks')) {
        detailsContent.push(<p key="no-points" className="text-highlight-silver mt-4 text-center">No points scored in this category for any completed events.</p>);
    }

    setModalData({ title, content: <div className="space-y-6">{detailsContent}</div> });
  };

  const handleEventScoringDetailClick = (eventId: string, category: 'gp' | 'sprint' | 'quali' | 'fl' | 'sprintQuali') => {
    const event = events.find(e => e.id === eventId);
    const picks = seasonPicks[eventId];
    const results = raceResults[eventId];

    if (!event || !picks || !results) return;

    let title = '';
    const eventEntries: React.ReactNode[] = [];
    let pointSource: (string | null)[] | undefined;
    let pointSystemArr: number[] | undefined;

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
        case 'sprintQuali':
            title = `${event.name} - Sprint Quali Points`;
            pointSource = results.sprintQualifying;
            pointSystemArr = pointsSystem.sprintQualifying;
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
                    teamPoints += getDriverPoints(driver.id, pointSource, pointSystemArr!);
                }
            });
            eventEntries.push(<li key={`team-${teamId}`}>{getEntityName(teamId)}: <span className="font-semibold">{teamPoints} pts</span></li>);
        });

        allPickedDrivers.forEach(driverId => {
            const driverPoints = getDriverPoints(driverId, pointSource, pointSystemArr!);
            eventEntries.push(<li key={`driver-${driverId}`}>{getEntityName(driverId)}: <span className="font-semibold">{driverPoints} pts</span></li>);
        });
    }

    if (eventEntries.length === 0 || eventEntries.every(e => (e as any).props.children[2].props.children[0] === 0)) {
       eventEntries.push(<li key="no-points" className="text-highlight-silver">No points scored in this category.</li>);
    }
    
    const finalContent = <ul className="list-none space-y-1 text-ghost-white text-sm text-center">{eventEntries}</ul>

    setModalData({ title, content: finalContent });
  };

  const handleUsageDetailClick = (entityId: string, entityName: string) => {
    const usageEvents = events.filter(event => {
        const picks = seasonPicks[event.id];
        if (!picks) return false;
        
        const allPicked = [
            ...picks.aTeams, 
            picks.bTeam, 
            ...picks.aDrivers, 
            ...picks.bDrivers
        ].filter(Boolean);
        
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

  const hasHistory = events.some(event => seasonPicks[event.id]);

  const isDuesUnpaid = (user.duesPaidStatus || 'Unpaid') !== 'Paid';
  const showEditControls = !isEditingProfile && setActivePage && !isPublicView;
  
  // Only show dues indicator if Unpaid AND NOT in public view (modal)
  // This prevents incorrect or irrelevant flashing in the leaderboard modal
  const showDuesIndicator = isDuesUnpaid && !isPublicView;

  const showTopSection = showDuesIndicator || showEditControls;

  return (
    <>
    <div className="max-w-7xl mx-auto text-pure-white space-y-8">
      {/* Page Header - Only show if not in public view, or show simplified title */}
      {!isPublicView && (
          <PageHeader 
              title="PROFILE" 
              icon={ProfileIcon} 
          />
      )}

      {/* Profile Info Section */}
      <div className="bg-carbon-fiber rounded-lg p-6 ring-1 ring-pure-white/10 relative shadow-2xl">
        {showTopSection && (
            <div className="flex flex-col items-center justify-center mb-8 relative z-10">
                {/* Dues Status - Only show if Unpaid and Private View */}
                {showDuesIndicator && (
                    <button 
                        onClick={handleDuesClick}
                        disabled={!setActivePage || isPublicView}
                        className={`px-4 py-1.5 text-xs font-extrabold uppercase rounded-full transition-all hover:scale-105 border border-black/20 shadow-md mb-3 bg-primary-red text-pure-white animate-pulse-red-limited ${setActivePage && !isPublicView ? 'cursor-pointer hover:opacity-100' : 'cursor-default'}`}
                    >
                        Dues: Unpaid
                    </button>
                )}

                {/* Edit Details Button - Hide in Public View */}
                {showEditControls && (
                    <div className="flex flex-col items-center gap-3">
                        <button 
                            onClick={() => setIsEditingProfile(true)}
                            className="text-sm font-bold text-pure-white hover:text-pure-white transition-all bg-carbon-black/90 px-6 py-2 rounded-full border border-pure-white/20 hover:border-primary-red/50 shadow-lg hover:shadow-primary-red/20 uppercase tracking-wide backdrop-blur-sm"
                        >
                            Edit Details
                        </button>
                        <button 
                            onClick={handlePasswordReset}
                            disabled={resetCooldown}
                            className="text-xs font-semibold text-highlight-silver hover:text-pure-white transition-all px-5 py-1.5 rounded-full border border-accent-gray hover:border-highlight-silver disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {resetCooldown ? 'Reset Link Sent ✓' : 'Reset Password'}
                        </button>
                        {resetStatus && (
                            <p className={`text-xs text-center ${resetStatus.type === 'success' ? 'text-green-500' : 'text-primary-red'}`}>
                                {resetStatus.message}
                            </p>
                        )}
                    </div>
                )}
            </div>
        )}
        
        {isEditingProfile ? (
            <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-lg mx-auto bg-carbon-black/50 border border-pure-white/10 shadow-2xl p-6 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-highlight-silver mb-1.5">First Name</label>
                        <input 
                            type="text" 
                            value={profileForm.firstName} 
                            onChange={e => setProfileForm(prev => ({...prev, firstName: e.target.value}))}
                            placeholder="Required"
                            required
                            maxLength={50}
                            className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white focus:border-primary-red focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-highlight-silver mb-1.5">Last Name</label>
                        <input 
                            type="text" 
                            value={profileForm.lastName} 
                            onChange={e => setProfileForm(prev => ({...prev, lastName: e.target.value}))}
                            placeholder="Required"
                            required
                            maxLength={50}
                            className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white focus:border-primary-red focus:outline-none"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-highlight-silver mb-1.5">Display Name (Max 20)</label>
                    <input 
                        type="text" 
                        value={profileForm.displayName} 
                        onChange={e => setProfileForm(prev => ({...prev, displayName: e.target.value}))}
                        required
                        maxLength={20}
                        className="w-full bg-carbon-black border border-accent-gray rounded p-2 text-pure-white focus:border-primary-red focus:outline-none"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase text-highlight-silver mb-1.5">Email Address</label>
                    <input 
                        type="email" 
                        value={profileForm.email} 
                        readOnly
                        className="w-full bg-carbon-black/50 border border-accent-gray rounded p-2 text-highlight-silver cursor-not-allowed outline-none"
                    />
                    <p className="text-[10px] text-highlight-silver/50 mt-1 italic">Email cannot be changed after registration.</p>
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
            isPublicView ? (
                <div className="flex justify-center w-full">
                    <div className="flex flex-col items-center justify-center p-6 rounded-lg bg-black/20 w-full max-w-md border border-pure-white/5 shadow-inner">
                        <F1CarIcon className="w-8 h-8 text-primary-red mb-3 opacity-80" />
                        <span className="text-xs font-bold uppercase text-highlight-silver mb-2 tracking-widest">Team Name</span>
                        <span className="text-2xl md:text-4xl font-black text-pure-white text-center break-words w-full px-2 leading-tight">{user.displayName}</span>
                    </div>
                </div>
            ) : (
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full`}>
                    <InfoCard icon={F1CarIcon} label="Team Name" value={user.displayName} />
                    <InfoCard icon={DriverIcon} label="Name" value={`${user.firstName || ''} ${user.lastName || ''}`.trim() || '-'} />
                    <InfoCard icon={ProfileIcon} label="Email" value={user.email} />
                </div>
            )
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
            {/* Scoring Breakdown */}
            <div>
                <h2 className="text-2xl font-bold mb-4 text-center">Scoring Breakdown</h2>
                <div className="rounded-lg ring-1 ring-pure-white/10 overflow-hidden bg-carbon-fiber shadow-lg">
                    <div className="grid grid-cols-2 divide-x divide-pure-white/10 bg-black/20 border-b border-pure-white/10">
                        <div className="p-6 text-center">
                            <p className="text-xs font-bold text-highlight-silver uppercase tracking-widest mb-2">Total Points</p>
                            <p className="text-3xl md:text-4xl font-black text-pure-white">{scoreRollup.totalPoints}</p>
                        </div>
                        <div className="p-6 text-center">
                            <p className="text-xs font-bold text-highlight-silver uppercase tracking-widest mb-2 flex items-center justify-center gap-1">
                                <TrophyIcon className="w-3 h-3 text-primary-red" /> Championship Rank
                            </p>
                            <p className="text-3xl md:text-4xl font-black text-pure-white">{globalRank ? `#${globalRank}` : '-'}</p>
                        </div>
                    </div>
                    <div className="p-6">
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
            </div>

            {/* Selection Counts */}
            <div>
                <h2 className="text-2xl font-bold mb-4 text-center">Selection Counts</h2>
                <div className="rounded-lg p-6 ring-1 ring-pure-white/10 bg-carbon-fiber shadow-lg">
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
                            entities={aDrivers.map(d => ({ id: d.id, name: d.name, color: getTeamColor(d.constructorId) }))}
                            usageData={usageRollup.drivers}
                            limit={getLimit(EntityClass.A, 'drivers')}
                            onItemClick={handleUsageDetailClick}
                        />
                        <CollapsibleUsageList
                            title="Class B Drivers"
                            entities={bDrivers.map(d => ({ id: d.id, name: d.name, color: getTeamColor(d.constructorId) }))}
                            usageData={usageRollup.drivers}
                            limit={getLimit(EntityClass.B, 'drivers')}
                            onItemClick={handleUsageDetailClick}
                        />
                    </div>
                </div>
            </div>
        </div>

        {/* Right Column: Picks History */}
        <div>
            <h2 className="text-2xl font-bold mb-4 text-center">Picks & Points History</h2>
            <div className="space-y-2">
                {!hasHistory && (
                    <div className="bg-carbon-fiber rounded-lg p-8 ring-1 ring-pure-white/10 text-center flex flex-col items-center justify-center min-h-[250px] shadow-lg animate-fade-in">
                        <div className="bg-carbon-black p-4 rounded-full mb-4 border border-pure-white/10 shadow-inner">
                            <PicksIcon className="w-12 h-12 text-highlight-silver/30" />
                        </div>
                        <h3 className="text-xl font-bold text-pure-white mb-2">No History Yet</h3>
                        <p className="text-sm text-highlight-silver max-w-xs mx-auto leading-relaxed">
                            Your Grand Prix picks and scoring results will appear here once you submit your first entry for the {CURRENT_SEASON} season.
                        </p>
                    </div>
                )}
                {events.map(event => {
                    const picks = seasonPicks[event.id];
                    const results = raceResults[event.id];
                    if (!picks) return null;

                    const eventPoints = results ? calculatePointsForEvent(picks, results, pointsSystem, allDrivers) : { totalPoints: 0, grandPrixPoints: 0, sprintPoints: 0, gpQualifyingPoints: 0, sprintQualifyingPoints: 0, fastestLapPoints: 0, penaltyPoints: 0 };
                    const isExpanded = expandedEvent === event.id;
                    const hasPenalty = (picks.penalty || 0) > 0;
                    const rawPoints = eventPoints.totalPoints + (eventPoints.penaltyPoints || 0);

                    return (
                        <div key={event.id} className="relative rounded-lg ring-1 ring-pure-white/10 overflow-hidden bg-carbon-fiber shadow-lg">
                             {hasPenalty && (
                                <div className="absolute top-2 left-1/2 transform -translate-x-1/2 -rotate-6 border-4 border-red-500 text-red-500 font-black text-xl px-4 py-1 opacity-80 pointer-events-none z-10 whitespace-nowrap">
                                    PENALTY APPLIED (-{(picks.penalty! * 100).toFixed(0)}%)
                                </div>
                            )}
                            <button className={`w-full py-5 px-4 flex justify-between items-center cursor-pointer text-left hover:bg-pure-white/5 transition-colors ${hasPenalty ? 'bg-red-900/10' : ''}`} onClick={() => toggleEvent(event.id)}>
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
                                <div className="p-4 border-t border-accent-gray/50 text-sm bg-black/20">
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
                                                {event.hasSprint && results.sprintQualifying && (
                                                    <button onClick={() => handleEventScoringDetailClick(event.id, 'sprintQuali')} className="transition-transform transform hover:scale-105">
                                                        <PointChip icon={SprintIcon} label="Sprint Quali" points={eventPoints.sprintQualifyingPoints} />
                                                    </button>
                                                )}
                                                <button onClick={() => handleEventScoringDetailClick(event.id, 'fl')} className="transition-transform transform hover:scale-105">
                                                    <PointChip icon={FastestLapIcon} label="Fastest Lap" points={eventPoints.fastestLapPoints} />
                                                </button>
                                            </div>
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
                                    {onUpdatePenalty && !isPublicView && (
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
                })}
            </div>
        </div>
      </div>
    </div>
    {modalData && (
        <div className="fixed inset-0 bg-carbon-black/80 flex items-center justify-center z-50 p-4" onClick={() => setModalData(null)}>
            <div className="bg-carbon-fiber rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto border border-pure-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h3 className="text-2xl font-bold text-pure-white text-center flex-1">{modalData.title}</h3>
                         <button onClick={() => setModalData(null)} className="text-highlight-silver hover:text-pure-white text-3xl leading-none ml-4">&times;</button>
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
  const sortedEntities = [...entities].sort((a, b) => {
      const usageA = usageData[a.id] || 0;
      const usageB = usageData[b.id] || 0;
      if (usageA !== usageB) return usageB - usageA;
      return a.name.localeCompare(b.name);
  });

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
          {sortedEntities.map(e => (
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