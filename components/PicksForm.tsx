

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PickSelection, EntityClass, Event, Constructor, Driver, User } from '../types.ts';
import SelectorGroup from './SelectorGroup.tsx';
import { SubmitIcon } from './icons/SubmitIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { LockIcon } from './icons/LockIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { XCircleIcon } from './icons/XCircleIcon.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import { useToast } from '../contexts/ToastContext.tsx';
import CountdownTimer from './CountdownTimer.tsx';
import { parseLeagueDate, LEAGUE_TIMEZONE } from '../utils/dateUtils.ts';

const getInitialPicks = (): PickSelection => ({
  aTeams: [null, null],
  bTeam: null,
  aDrivers: [null, null, null],
  bDrivers: [null, null],
  fastestLap: null,
});

interface PicksFormProps {
  user: User;
  event: Event;
  initialPicksForEvent?: PickSelection;
  onPicksSubmit: (eventId: string, picks: PickSelection) => void;
  formLocks: { [eventId: string]: boolean };
  aTeams: Constructor[];
  bTeams: Constructor[];
  aDrivers: Driver[];
  bDrivers: Driver[];
  allDrivers: Driver[];
  allConstructors: Constructor[];
  getUsage: (id: string, type: 'teams' | 'drivers') => number;
  getLimit: (entityClass: EntityClass, type: 'teams' | 'drivers') => number;
  hasRemaining: (id: string, type: 'teams' | 'drivers') => boolean;
  cancelledEventIds: Set<string>;
}

interface ExhaustionStatus {
  isExhausted: boolean;
  fillable: number;
  slotsNeeded: number;
  emptySlots: number;
  uniqueAvailable: number;
}

const PicksForm: React.FC<PicksFormProps> = ({
  user,
  event,
  initialPicksForEvent,
  onPicksSubmit,
  formLocks,
  aTeams,
  bTeams,
  aDrivers,
  bDrivers,
  allDrivers,
  allConstructors,
  getUsage,
  getLimit,
  hasRemaining,
  cancelledEventIds
}) => {
  const [picks, setPicks] = useState<PickSelection>(initialPicksForEvent || getInitialPicks());
  const [isEditing, setIsEditing] = useState<boolean>(!initialPicksForEvent);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  
  // Time-based locking logic
  const [isTimeLocked, setIsTimeLocked] = useState(() => {
      return event.lockAtUtc ? parseLeagueDate(event.lockAtUtc).getTime() <= Date.now() : false;
  });

  const { showToast } = useToast();

  const isSubmitted = !!initialPicksForEvent;
  const isEventCancelled = cancelledEventIds.has(event.id);
  
  // Unified lock variables
  const isEffectiveLocked = formLocks[event.id] || isTimeLocked || isEventCancelled;
  const isFormDisabled = isEffectiveLocked && !user.isAdmin;

  // Handle expiration from the Timer component
  const handleTimerExpire = useCallback(() => {
      if (!isTimeLocked) {
          setIsTimeLocked(true);
          if (isEditing && !user.isAdmin) {
              showToast("Time's up! Picks for this event are now locked.", 'error');
          }
      }
  }, [isTimeLocked, isEditing, user.isAdmin, showToast]);

  // Sync state if event changes
  useEffect(() => {
    const savedPicks = initialPicksForEvent;
    setPicks(savedPicks || getInitialPicks());
    setIsEditing(!savedPicks);
    setIsTimeLocked(event.lockAtUtc ? parseLeagueDate(event.lockAtUtc).getTime() <= Date.now() : false);
  }, [event.id, initialPicksForEvent, event.lockAtUtc]);

  // Force-exit editing mode if form becomes locked mid-session
  useEffect(() => {
    if (isFormDisabled && isEditing) {
        setIsEditing(false);
        // FIX: Changed toast type from 'warning' to 'info' as 'warning' is not a valid type.
        showToast("This event has been locked by the administrator.", 'info');
    }
  }, [isFormDisabled, isEditing, showToast]);

  // Sort drivers by constructor RANK to pair teammates together
  const sortedDrivers = useMemo(() => {
    return [...allDrivers].sort((a, b) => {
        const getRank = (id: string) => CONSTRUCTORS.findIndex(c => c.id === id) ?? 999;
        const teamAIndex = getRank(a.constructorId);
        const teamBIndex = getRank(b.constructorId);
        if (teamAIndex !== teamBIndex) return teamAIndex - teamBIndex;
        return a.name.localeCompare(b.name);
    });
  }, [allDrivers]);

  // === EXHAUSTION DETECTION ===
  const exhaustionReport = useMemo((): Record<string, ExhaustionStatus> => {
    const check = (
      options: { id: string; class: EntityClass }[],
      selectedInSlots: (string | null)[],
      entityType: 'teams' | 'drivers'
    ): ExhaustionStatus => {
      // Calculate distinct fillable options:
      // 1. Options that are available to be picked (hasRemaining = true)
      // 2. Options that are ALREADY picked in this form (even if they have reached limit in global state, e.g. editing)
      const availableIds = options.filter(o => hasRemaining(o.id, entityType)).map(o => o.id);
      const selectedIds = selectedInSlots.filter((id): id is string => !!id);
      
      const distinctFillableCount = new Set([...availableIds, ...selectedIds]).size;
      const slotsNeeded = selectedInSlots.length;

      // Maximum slots we can actually fill
      const fillable = Math.min(distinctFillableCount, slotsNeeded);
      const isExhausted = fillable < slotsNeeded;
      const emptySlots = slotsNeeded - fillable;

      // uniqueAvailable for display purposes (just the pool)
      const uniqueAvailable = availableIds.length;

      return { isExhausted, fillable, slotsNeeded, emptySlots, uniqueAvailable };
    };

    return {
      aTeams: check(aTeams, picks.aTeams, 'teams'),
      bTeam: check(bTeams, [picks.bTeam], 'teams'),
      aDrivers: check(aDrivers, picks.aDrivers, 'drivers'),
      bDrivers: check(bDrivers, picks.bDrivers, 'drivers'),
    };
  }, [aTeams, bTeams, aDrivers, bDrivers, picks, hasRemaining]);

  const hasExhaustedCategory = Object.values(exhaustionReport).some((r: any) => r.isExhausted);

  // Helper for submit confirmation check
  const hasEmptySlots = () => {
    return picks.aTeams.some(p => !p) || !picks.bTeam ||
           picks.aDrivers.some(p => !p) || picks.bDrivers.some(p => !p);
  };

  const handleSelect = useCallback((category: keyof PickSelection, value: string | null, index?: number) => {
    if (isFormDisabled) return; // HARD STOP
    setPicks(prev => {
      const newPicks = { ...prev };
      const field = newPicks[category];
      if (Array.isArray(field) && typeof index === 'number') {
        const newArray = [...field];
        newArray[index] = value;
        (newPicks as any)[category] = newArray;
      } else {
        (newPicks as any)[category] = value;
      }
      return newPicks;
    });
  }, [isFormDisabled]);
  
  const isSelectionComplete = () => {
      // Fastest Lap has no usage limit — always required
      if (!picks.fastestLap) return false;

      const checkCategory = (
        selected: (string | null)[],
        report: { fillable: number; isExhausted: boolean }
      ) => {
        const filledCount = selected.filter(Boolean).length;
        if (report.isExhausted) {
          // Accept partial — user filled as many as physically possible
          return filledCount >= report.fillable;
        }
        // Normal — all slots must be filled
        return selected.every(p => p);
      };

      return checkCategory(picks.aTeams, exhaustionReport.aTeams) &&
             checkCategory([picks.bTeam], exhaustionReport.bTeam) &&
             checkCategory(picks.aDrivers, exhaustionReport.aDrivers) &&
             checkCategory(picks.bDrivers, exhaustionReport.bDrivers);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormDisabled) {
        showToast("This event is locked. Picks cannot be submitted.", 'error');
        return;
    }
    if (user.isAdmin && isTimeLocked) {
        if (!confirm("Admin Override: This event is time-locked. Submit anyway?")) {
            return;
        }
    }
    
    if (isSelectionComplete()) {
        // Partial lineup confirmation
        if (hasEmptySlots() && hasExhaustedCategory) {
            const exhaustedCategoryNames = Object.entries(exhaustionReport)
                .filter(([_, r]: [string, any]) => r.isExhausted)
                .map(([key, r]: [string, any]) => {
                    const labels: Record<string, string> = {
                        aTeams: 'Class A Teams', bTeam: 'Class B Team',
                        aDrivers: 'Class A Drivers', bDrivers: 'Class B Drivers',
                    };
                    return `${labels[key]} (${r.emptySlots} empty slot${r.emptySlots > 1 ? 's' : ''})`;
                });

            const modalBody = (
                <div className="p-6 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-900/30 border-2 border-amber-500/50 flex items-center justify-center">
                        <span className="text-2xl">⚠️</span>
                    </div>
                    <h4 className="text-2xl font-bold text-pure-white mb-4">Partial Lineup Submission</h4>
                    <p className="text-highlight-silver text-sm mb-4">
                        You are submitting a partial lineup due to pick limits exhaustion.
                    </p>
                    <div className="bg-carbon-black/50 border border-pure-white/10 rounded-lg p-4 mb-6 text-left">
                        <p className="text-pure-white font-semibold mb-2">Exhausted Categories:</p>
                        <ul className="list-disc list-inside text-amber-400/90 text-sm space-y-1">
                            {exhaustedCategoryNames.map((reason, idx) => (
                                <li key={idx}>{reason}</li>
                            ))}
                        </ul>
                    </div>
                    <p className="text-amber-500/80 text-xs mb-6 font-bold uppercase tracking-wider">
                        Empty slots will score 0 points for this race.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <button 
                            type="button"
                            onClick={() => setModalContent(null)}
                            className="bg-accent-gray hover:bg-accent-gray/80 text-pure-white font-bold py-3 px-6 rounded-lg transition-colors flex-1"
                        >
                            Cancel
                        </button>
                        <button 
                            type="button"
                            onClick={() => {
                                setModalContent(null);
                                onPicksSubmit(event.id, picks);
                                setIsEditing(false);
                            }}
                            className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-6 rounded-lg transition-colors flex-1 shadow-lg shadow-primary-red/20"
                        >
                            Confirm & Submit
                        </button>
                    </div>
                </div>
            );
            
            setModalContent(modalBody);
            return;
        }

        onPicksSubmit(event.id, picks);
        setIsEditing(false);
    } else {
        showToast("Please complete all available selections before submitting.", 'error');
    }
  };
  
  // CANCELLED GATE
  if (isEventCancelled) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
        <div className="max-w-4xl w-full text-center bg-carbon-fiber rounded-xl p-8 border border-primary-red/30 shadow-2xl animate-fade-in-up relative overflow-hidden">
          {/* Diagonal CANCELLED watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
            <span className="text-9xl font-black text-primary-red -rotate-12 select-none whitespace-nowrap">
              CANCELLED
            </span>
          </div>
          <div className="relative z-10">
            <div className="inline-block p-4 rounded-full bg-primary-red/10 border border-primary-red/30 mb-6">
              <svg className="w-16 h-16 text-primary-red" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <h2 className="text-3xl font-black text-primary-red mb-2 uppercase tracking-wider">Event Cancelled</h2>
            <p className="text-ghost-white text-lg mb-2">{event.name} has been cancelled.</p>
            <p className="text-highlight-silver text-sm">
              Picks for this event do not count against your selection limits.<br/>
              No points will be scored for this event.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // PRIMARY LOCK GATE: If locked for a non-admin, show the lock screen immediately.
  if (isFormDisabled) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
            <div className="max-w-4xl w-full text-center bg-carbon-fiber rounded-xl p-8 border border-primary-red/30 shadow-2xl ring-1 ring-primary-red/50 relative overflow-hidden">
                <div className="absolute inset-0 bg-checkered-flag opacity-[0.02] pointer-events-none"></div>
                <LockIcon className="w-16 h-16 text-primary-red mx-auto mb-4 relative z-10" />
                <h2 className="text-3xl font-bold text-ghost-white mb-2 relative z-10">Picks Are Locked</h2>
                <p className="text-highlight-silver relative z-10">
                    {isSubmitted 
                        ? "Your submitted picks for this event are final and cannot be edited."
                        : "This event has been locked. Picks can no longer be submitted."
                    }
                </p>
                {isSubmitted && (
                    <p className="text-xs text-highlight-silver/60 mt-4 relative z-10">
                        Your picks were submitted before the lock. Good luck!
                    </p>
                )}
            </div>
        </div>
    );
  }
  
  // Confirmation Screen (if not editing and not locked)
  if (!isEditing) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
            <div className="max-w-4xl w-full text-center bg-carbon-fiber rounded-xl p-8 border border-pure-white/10 shadow-2xl animate-fade-in-up relative overflow-hidden">
                <h2 className="text-3xl font-bold text-ghost-white mb-4 relative z-10">Picks Submitted Successfully!</h2>
                <p className="text-ghost-white relative z-10">Your picks for the {event.name} are locked in. Good luck, {user.displayName}!</p>
                
                {!isEffectiveLocked && (
                    <div className="mt-6 p-4 bg-carbon-black/40 rounded-lg inline-block border border-pure-white/5 backdrop-blur-sm relative z-10">
                        <p className="text-[10px] text-highlight-silver uppercase tracking-widest font-bold mb-2">Time Remaining to Edit</p>
                        <CountdownTimer targetDate={event.lockAtUtc} onExpire={handleTimerExpire} />
                    </div>
                )}

                <div className="mt-8 relative z-10">
                    <button 
                        onClick={() => setIsEditing(true)} 
                        disabled={isFormDisabled}
                        className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg disabled:bg-accent-gray disabled:cursor-not-allowed transition-transform hover:scale-105 shadow-lg shadow-primary-red/20"
                    >
                        {isFormDisabled ? 'Editing Locked' : 'Edit Picks'}
                    </button>
                </div>
            </div>
        </div>
    );
  }

  // Resolve Fastest Lap Selections
  const selectedFLDriver = allDrivers.find(d => d.id === picks.fastestLap) || null;
  let flColor = undefined;
  let flSubtitle = undefined;
  if (selectedFLDriver) {
      const cId = selectedFLDriver.constructorId;
      flColor = allConstructors.find(c => c.id === cId)?.color || CONSTRUCTORS.find(c => c.id === cId)?.color;
      flSubtitle = allConstructors.find(c => c.id === cId)?.name || CONSTRUCTORS.find(c => c.id === cId)?.name;
  }

  const openFastestLapModal = () => {
      if(isFormDisabled) return;
      const isAnyFastestLapSelected = !!picks.fastestLap;
      const modalBody = (
          <div className="p-6">
              <div className="text-center mb-6">
                  <h4 className="text-2xl font-bold text-pure-white">Select Fastest Lap</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   {sortedDrivers.map(driver => {
                       let constructor = allConstructors.find(c => c.id === driver.constructorId) || CONSTRUCTORS.find(c => c.id === driver.constructorId);
                       const color = constructor?.color;
                       const subtitle = constructor?.name;
                       return (
                           <SelectorCard
                               key={driver.id}
                               option={driver}
                               isSelected={picks.fastestLap === driver.id}
                               onClick={() => { handleSelect('fastestLap', driver.id); setModalContent(null); }}
                               placeholder="Driver"
                               disabled={isFormDisabled}
                               color={color}
                               forceColor={!isAnyFastestLapSelected}
                               subtitle={subtitle}
                           />
                       );
                   })}
              </div>
          </div>
      );
      setModalContent(modalBody);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-4">
        <div className="bg-carbon-fiber rounded-lg p-4 ring-1 ring-pure-white/10 flex flex-col md:flex-row justify-between md:items-center gap-4 flex-none border border-pure-white/5 relative overflow-hidden">
          {/* CANCELLED WATERMARK */}
          {isEventCancelled && (
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none overflow-hidden z-0">
                  <span className="text-[15vw] font-black uppercase tracking-tighter -rotate-12 whitespace-nowrap">CANCELLED</span>
              </div>
          )}
          
          <div className="flex-grow text-center md:text-left z-10">
            <div className="flex items-center justify-center md:justify-start gap-3">
                <h2 className="text-2xl md:text-3xl font-bold text-pure-white leading-tight">{event.name}</h2>
                {isEventCancelled && (
                    <span className="bg-red-500 text-pure-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest animate-pulse">
                        Cancelled
                    </span>
                )}
            </div>
            <p className="text-highlight-silver text-sm md:text-base mt-1">Round {event.round} - {event.country} ({event.location})</p>
            <p className="text-pure-white/80 font-semibold text-sm md:text-base mt-1 flex items-center justify-center md:justify-start gap-2">
                <span>{(parseLeagueDate(event.lockAtUtc) || new Date(event.lockAtUtc)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: LEAGUE_TIMEZONE })}</span>
                <span className="text-highlight-silver">•</span>
                <span className="font-mono text-primary-red">
                    {(parseLeagueDate(event.lockAtUtc) || new Date(event.lockAtUtc)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: LEAGUE_TIMEZONE })} ET
                </span>
            </p>
          </div>
          <div className="flex flex-col items-center justify-center py-2 md:py-0 md:px-6 z-10 border-y md:border-y-0 md:border-x border-pure-white/5 bg-black/10 md:bg-transparent rounded-lg md:rounded-none">
              <p className="text-[9px] md:text-[10px] text-highlight-silver uppercase tracking-[0.2em] font-bold mb-1 opacity-80">Time Remaining</p>
              {isEventCancelled ? (
                  <span className="text-red-500 font-black text-xl md:text-2xl italic tracking-tighter">N/A</span>
              ) : (
                  <CountdownTimer targetDate={event.lockAtUtc} onExpire={handleTimerExpire} />
              )}
          </div>
          <div className="text-center bg-carbon-black/20 p-2 rounded-lg md:bg-transparent md:p-0 flex flex-col items-center justify-center gap-2 min-w-[120px] z-10">
              <div>
                  <p className="hidden md:block text-[10px] md:text-sm uppercase tracking-wider font-semibold text-highlight-silver">
                      {isEventCancelled ? "Event Status" : isEffectiveLocked ? "Picks Locked" : "Picks Open"}
                  </p>
                  <p className={`text-xl md:text-3xl font-bold tracking-tighter ${isEventCancelled || isEffectiveLocked ? "text-primary-red" : "text-pure-white"}`}>
                      {isEventCancelled ? "CANCELLED" : isEffectiveLocked ? "LOCKED" : "OPEN"}
                  </p>
              </div>
              <div>
                {isSubmitted ? (
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider bg-green-600/80 text-pure-white px-3 py-1 rounded-full shadow-lg shadow-green-900/20">Submitted</span>
                ) : (
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider bg-accent-gray/50 text-ghost-white px-3 py-1 rounded-full border border-pure-white/10">Unsubmitted</span>
                )}
              </div>
          </div>
        </div>

        {/* CANCELLED STAMP PANEL */}
        {isEventCancelled && (
            <div className="bg-red-950/10 border border-red-500/30 rounded-xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center flex-shrink-0">
                    <XCircleIcon className="w-8 h-8 text-red-500" />
                </div>
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl md:text-2xl font-black text-pure-white uppercase tracking-tighter italic mb-1">Session Officially Cancelled</h3>
                    <p className="text-highlight-silver text-sm leading-relaxed max-w-2xl">
                        This Grand Prix has been removed from the 2026 championship calendar. 
                        Picks for this event will <span className="text-red-500 font-bold">not count</span> towards usage limits or seasonal scoring.
                    </p>
                </div>
                <div className="flex flex-col gap-2 min-w-[140px]">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-highlight-silver bg-carbon-black/40 px-3 py-1.5 rounded border border-pure-white/5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Scoring: Disabled
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-highlight-silver bg-carbon-black/40 px-3 py-1.5 rounded border border-pure-white/5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Usage: Exempt
                    </div>
                </div>
            </div>
        )}

        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${isEventCancelled ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
            {hasExhaustedCategory && (
              <div className="lg:col-span-2 bg-amber-900/30 border border-amber-500/50 rounded-lg p-4 flex items-start gap-3 animate-fade-in-up">
                 <span className="text-amber-400 text-xl flex-shrink-0 mt-0.5">⚠️</span>
                 <div>
                     <p className="text-amber-200 font-bold text-sm">Usage Limits Reached</p>
                     <p className="text-amber-300/80 text-xs mt-1">
                         You've used all available picks for: {Object.entries(exhaustionReport).filter(([_, r]: [string, any]) => r.isExhausted).map(([key]) => {
                            const labels: Record<string, string> = { aTeams: 'Class A Teams', bTeam: 'Class B Team', aDrivers: 'Class A Drivers', bDrivers: 'Class B Drivers' };
                            return labels[key];
                         }).join(', ')}.
                         Empty slots are allowed and will score 0 points.
                     </p>
                 </div>
              </div>
            )}
            <SelectorGroup
                title="Class A Teams" slots={2} options={aTeams} selected={picks.aTeams}
                onSelect={(value, index) => handleSelect('aTeams', value, index)}
                getUsage={getUsage} getLimit={getLimit} hasRemaining={hasRemaining}
                entityType="teams" setModalContent={setModalContent} disabled={isFormDisabled} allConstructors={allConstructors}
                isExhausted={exhaustionReport.aTeams.isExhausted}
            />
            <SelectorGroup
                title="Class A Drivers" slots={3} options={aDrivers} selected={picks.aDrivers}
                onSelect={(value, index) => handleSelect('aDrivers', value, index)}
                getUsage={getUsage} getLimit={getLimit} hasRemaining={hasRemaining}
                entityType="drivers" setModalContent={setModalContent} disabled={isFormDisabled} allConstructors={allConstructors}
                isExhausted={exhaustionReport.aDrivers.isExhausted}
            />
            <SelectorGroup
                title="Class B Team" slots={1} options={bTeams} selected={[picks.bTeam]}
                onSelect={(value) => handleSelect('bTeam', value, 0)}
                getUsage={getUsage} getLimit={getLimit} hasRemaining={hasRemaining}
                entityType="teams" setModalContent={setModalContent} disabled={isFormDisabled} allConstructors={allConstructors}
                isExhausted={exhaustionReport.bTeam.isExhausted}
            />
            <SelectorGroup
                title="Class B Drivers" slots={2} options={bDrivers} selected={picks.bDrivers}
                onSelect={(value, index) => handleSelect('bDrivers', value, index)}
                getUsage={getUsage} getLimit={getLimit} hasRemaining={hasRemaining}
                entityType="drivers" setModalContent={setModalContent} disabled={isFormDisabled} allConstructors={allConstructors}
                isExhausted={exhaustionReport.bDrivers.isExhausted}
            />
        </div>

        <div className="bg-carbon-fiber rounded-lg p-4 md:p-6 ring-1 ring-pure-white/10 flex flex-col md:flex-row items-end gap-4 md:gap-8 border border-pure-white/5">
             <div className="w-full md:flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <FastestLapIcon className="w-5 h-5 text-primary-red" />
                    <h3 className="text-lg font-bold text-pure-white">Fastest Lap</h3>
                </div>
                <div className="h-14">
                    <SelectorCard 
                        option={selectedFLDriver} isSelected={!!selectedFLDriver}
                        onClick={openFastestLapModal} placeholder="Select Driver"
                        disabled={isFormDisabled} color={flColor} forceColor={!!selectedFLDriver}
                        subtitle={flSubtitle}
                    />
                </div>
            </div>
            <div className="w-full md:flex-1">
                <button
                    type="submit"
                    disabled={!isSelectionComplete() || isFormDisabled}
                    className="w-full h-14 flex items-center justify-center gap-3 bg-primary-red hover:opacity-90 text-pure-white font-bold text-xl rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-primary-red/30 disabled:bg-accent-gray disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isFormDisabled ? <LockIcon className="w-6 h-6" /> : <SubmitIcon className="w-6 h-6" />}
                    {isFormDisabled ? 'Event Locked' : (hasEmptySlots() && hasExhaustedCategory ? 'Lock In Partial Lineup' : 'Lock In Picks')}
                </button>
            </div>
        </div>
      </form>
      
      {modalContent && (
        <div 
          className="fixed inset-0 bg-carbon-black/80 flex items-end md:items-center justify-center z-[999] md:p-4 pb-safe md:pb-4" 
          onClick={() => setModalContent(null)}
        >
          <div 
            className="bg-carbon-fiber rounded-t-2xl md:rounded-lg w-full md:max-w-3xl max-h-[85vh] md:max-h-[80vh] overflow-y-auto animate-slide-up shadow-2xl ring-1 ring-pure-white/10 border border-pure-white/10" 
            onClick={(e) => e.stopPropagation()}
          >
              <div className="md:hidden w-full flex justify-center pt-3 pb-1" onClick={() => setModalContent(null)}>
                  <div className="w-12 h-1.5 bg-pure-white/20 rounded-full"></div>
              </div>
              {modalContent}
          </div>
        </div>
      )}
    </>
  );
};

interface SelectorCardProps {
    option: { id: string, name: string } | null;
    isSelected: boolean;
    onClick: () => void;
    isDropdown?: boolean;
    options?: { id: string, name: string, class: EntityClass }[];
    onSelect?: (id: string | null) => void;
    placeholder?: string;
    usage?: string;
    disabled?: boolean;
    color?: string;
    forceColor?: boolean;
    subtitle?: string;
}

export const SelectorCard: React.FC<SelectorCardProps> = ({ option, isSelected, onClick, isDropdown, options, onSelect, placeholder, usage, disabled, color, forceColor, subtitle }) => {
    
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const showColor = (isSelected || forceColor) && color;

    const cardStyle: React.CSSProperties = showColor && !disabled ? {
        borderColor: color,
        backgroundColor: hexToRgba(color, isSelected ? 0.25 : 0.1),
        boxShadow: isSelected ? `0 10px 15px -3px ${hexToRgba(color, 0.2)}` : undefined
    } : {};
    
    if (isDropdown && options && onSelect) { // This path is not currently used but kept for potential future UI variants
        return (
            <div className="relative">
                <select
                    value={option?.id || ''}
                    onChange={(e) => onSelect(e.target.value || null)}
                    disabled={disabled}
                    style={color && isSelected ? { borderColor: color, boxShadow: `0 0 0 1px ${color}` } : {}}
                    className="w-full bg-carbon-black/70 border border-accent-gray rounded-md shadow-sm py-2 px-4 text-sm text-pure-white focus:outline-none focus:ring-primary-red focus:border-primary-red appearance-none disabled:bg-accent-gray disabled:cursor-not-allowed transition-all"
                >
                    <option value="">{placeholder}</option>
                    {options.map(opt => (
                        <option key={opt.id} value={opt.id} disabled={disabled || (usage?.includes('0') && opt.id !== option?.id)}>
                            {opt.name}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-highlight-silver">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
        );
    }
    
    return (
        <div 
            onClick={disabled ? undefined : onClick}
            style={cardStyle}
            className={`
                p-1.5 rounded-lg border-2 flex flex-col justify-center items-center h-full text-center
                transition-all duration-200 min-h-[3.5rem]
                ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none grayscale' : 'cursor-pointer'}
                ${isSelected && !color && !disabled ? 'bg-primary-red/20 border-primary-red shadow-lg shadow-primary-red/20' : ''}
                ${!showColor && !isSelected && !disabled ? 'border-accent-gray bg-carbon-black/50 hover:border-highlight-silver' : ''}
            `}
        >
            <p className={`font-bold text-sm md:text-base leading-tight ${isSelected || forceColor ? 'text-pure-white' : 'text-ghost-white'}`}>
                {option ? option.name : placeholder}
            </p>
            {subtitle && option && (
                <p className="text-[10px] text-highlight-silver uppercase tracking-wider opacity-80 leading-none mt-0.5">
                    {subtitle}
                </p>
            )}
            {usage && <p className={`text-[10px] md:text-xs mt-0.5 ${isSelected ? (color ? 'text-pure-white' : 'text-primary-red') : 'text-highlight-silver'}`}>{usage}</p>}
        </div>
    );
};

export default PicksForm;
