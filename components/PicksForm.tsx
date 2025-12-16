
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PickSelection, EntityClass, Event, Constructor, Driver, User } from '../types.ts';
import SelectorGroup from './SelectorGroup.tsx';
import { SubmitIcon } from './icons/SubmitIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { LockIcon } from './icons/LockIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { CONSTRUCTORS } from '../constants.ts';
import { useToast } from '../contexts/ToastContext.tsx';

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
  hasRemaining
}) => {
  const [picks, setPicks] = useState<PickSelection>(initialPicksForEvent || getInitialPicks());
  const [isEditing, setIsEditing] = useState<boolean>(!initialPicksForEvent);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);
  const { showToast } = useToast();

  const isSubmitted = !!initialPicksForEvent;
  // Admin can edit even if locked.
  const isLockedByAdmin = formLocks[event.id] && !user.isAdmin;

  useEffect(() => {
    const savedPicks = initialPicksForEvent;
    setPicks(savedPicks || getInitialPicks());
    setIsEditing(!savedPicks);
  }, [event.id, initialPicksForEvent]);

  // Sort drivers by constructor RANK (based on constants/2025 Standings) 
  // to pair teammates together in the grid in correct team order (McLaren -> Cadillac)
  const sortedDrivers = useMemo(() => {
    return [...allDrivers].sort((a, b) => {
        const getRank = (id: string) => {
            const idx = CONSTRUCTORS.findIndex(c => c.id === id);
            return idx === -1 ? 999 : idx;
        };

        const teamAIndex = getRank(a.constructorId);
        const teamBIndex = getRank(b.constructorId);
        
        // Sort by team rank 
        if (teamAIndex !== teamBIndex) {
            return teamAIndex - teamBIndex;
        }
        // Then by driver name
        return a.name.localeCompare(b.name);
    });
  }, [allDrivers]);

  const handleSelect = useCallback((category: keyof PickSelection, value: string | null, index?: number) => {
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
  }, []);
  
  const isSelectionComplete = () => {
      return picks.aTeams.every(p => p) &&
             picks.bTeam &&
             picks.aDrivers.every(p => p) &&
             picks.bDrivers.every(p => p) &&
             picks.fastestLap;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Security: Client-side time validation
    const lockTime = new Date(event.lockAtUtc).getTime();
    if (Date.now() >= lockTime) {
        if (!user.isAdmin) {
            showToast("Submissions for this event are closed.", 'error');
            return;
        } else {
             // Optional: Warn admin
             if (!confirm("Event is technically locked. Submit anyway (Admin Override)?")) {
                 return;
             }
        }
    }

    if(isSelectionComplete()) {
        onPicksSubmit(event.id, picks);
        setIsEditing(false);
    } else {
        showToast("Please complete all selections before submitting.", 'error');
    }
  };
  
  if (isLockedByAdmin && !isEditing) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
            <div className="max-w-4xl w-full text-center bg-accent-gray/50 backdrop-blur-sm rounded-lg p-8 ring-1 ring-primary-red/50 shadow-2xl">
                <LockIcon className="w-12 h-12 text-primary-red mx-auto mb-4" />
                <h2 className="text-3xl font-bold text-ghost-white mb-2">Picks Are Locked</h2>
                <p className="text-ghost-white">Your submitted picks for this event cannot be edited.</p>
            </div>
        </div>
    );
  }

  // isFormLockedForStatus reflects UI state. 
  // If user is Admin, they can still edit, so we don't disable the "Edit Picks" button based on this alone.
  const isFormLockedForStatus = formLocks[event.id]; 
  const canEditDespiteLock = !!user.isAdmin;
  
  if(!isEditing) {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
            {/* Updated container with bg-carbon-fiber */}
            <div className="max-w-4xl w-full text-center bg-carbon-fiber rounded-xl p-8 border border-pure-white/10 shadow-2xl animate-fade-in-up">
                <h2 className="text-3xl font-bold text-ghost-white mb-4">Picks Submitted Successfully!</h2>
                <p className="text-ghost-white">Your picks for the {event.name} are locked in. Good luck, {user.displayName}!</p>
                <button 
                  onClick={() => setIsEditing(true)} 
                  disabled={isFormLockedForStatus && !canEditDespiteLock}
                  className="mt-6 bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg disabled:bg-accent-gray disabled:cursor-not-allowed transition-transform hover:scale-105"
                >
                  {isFormLockedForStatus && !canEditDespiteLock ? 'Editing Locked' : 'Edit Picks'}
                </button>
            </div>
        </div>
    );
  }

  // Resolve Fastest Lap Selections
  const selectedFLDriver = allDrivers.find(d => d.id === picks.fastestLap) || null;
  let flColor = undefined;
  if (selectedFLDriver) {
      const cId = selectedFLDriver.constructorId;
      flColor = allConstructors.find(c => c.id === cId)?.color || CONSTRUCTORS.find(c => c.id === cId)?.color;
  }

  const openFastestLapModal = () => {
      // Logic: Show colors for all if nothing is selected. If something is selected, only color that one.
      const isAnyFastestLapSelected = !!picks.fastestLap;

      const modalBody = (
          <div className="p-6">
              <div className="text-center mb-6">
                  <h4 className="text-2xl font-bold text-pure-white">Select Fastest Lap</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                   {sortedDrivers.map(driver => {
                       let constructor = allConstructors.find(c => c.id === driver.constructorId);
                       if (!constructor?.color) {
                           constructor = CONSTRUCTORS.find(c => c.id === driver.constructorId);
                       }
                       const color = constructor?.color;

                       return (
                           <SelectorCard
                               key={driver.id}
                               option={driver}
                               isSelected={picks.fastestLap === driver.id}
                               onClick={() => { handleSelect('fastestLap', driver.id); setModalContent(null); }}
                               placeholder="Driver"
                               disabled={isLockedByAdmin}
                               color={color}
                               forceColor={!isAnyFastestLapSelected}
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
        {/* Compact Event Header for Mobile */}
        <div className="bg-carbon-fiber rounded-lg p-4 ring-1 ring-pure-white/10 flex flex-col md:flex-row justify-between md:items-center gap-4 flex-none border border-pure-white/5">
          <div className="flex-grow text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-bold text-pure-white leading-tight">{event.name}</h2>
            <p className="text-highlight-silver text-sm md:text-base mt-1">Round {event.round} - {event.country} ({event.location})</p>
            <p className="text-pure-white/80 font-semibold text-sm md:text-base mt-1">
                {new Date(event.lockAtUtc).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          <div className="text-center bg-carbon-black/20 p-2 rounded-lg md:bg-transparent md:p-0 flex flex-col items-center justify-center gap-2">
              <div>
                  <p className="text-[10px] md:text-sm uppercase tracking-wider font-semibold text-highlight-silver">
                      {isFormLockedForStatus ? "Picks Locked" : "Picks Open"}
                  </p>
                  <p className={`text-xl md:text-3xl font-bold tracking-tighter ${isFormLockedForStatus ? "text-primary-red" : "text-pure-white"}`}>
                      {isFormLockedForStatus ? "LOCKED" : "OPEN"}
                  </p>
              </div>
              <div>
                {isSubmitted ? (
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider bg-green-600/80 text-pure-white px-3 py-1 rounded-full">Submitted</span>
                ) : (
                    <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider bg-accent-gray/50 text-ghost-white px-3 py-1 rounded-full">Unsubmitted</span>
                )}
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column: Teams */}
            <div className="space-y-4">
                 <SelectorGroup
                    title="Class A Teams"
                    slots={2}
                    options={aTeams}
                    selected={picks.aTeams}
                    onSelect={(value, index) => handleSelect('aTeams', value, index)}
                    getUsage={getUsage}
                    getLimit={getLimit}
                    hasRemaining={hasRemaining}
                    entityType="teams"
                    setModalContent={setModalContent}
                    disabled={isLockedByAdmin}
                    allConstructors={allConstructors}
                />

                <SelectorGroup
                    title="Class B Team"
                    slots={1}
                    options={bTeams}
                    selected={[picks.bTeam]}
                    onSelect={(value) => handleSelect('bTeam', value, 0)}
                    getUsage={getUsage}
                    getLimit={getLimit}
                    hasRemaining={hasRemaining}
                    entityType="teams"
                    setModalContent={setModalContent}
                    disabled={isLockedByAdmin}
                    allConstructors={allConstructors}
                />
            </div>

            {/* Right Column: Drivers */}
            <div className="space-y-4 flex flex-col">
                 <SelectorGroup
                    title="Class A Drivers"
                    slots={3}
                    options={aDrivers}
                    selected={picks.aDrivers}
                    onSelect={(value, index) => handleSelect('aDrivers', value, index)}
                    getUsage={getUsage}
                    getLimit={getLimit}
                    hasRemaining={hasRemaining}
                    entityType="drivers"
                    setModalContent={setModalContent}
                    disabled={isLockedByAdmin}
                    allConstructors={allConstructors}
                />
                
                <SelectorGroup
                    title="Class B Drivers"
                    slots={2}
                    options={bDrivers}
                    selected={picks.bDrivers}
                    onSelect={(value, index) => handleSelect('bDrivers', value, index)}
                    getUsage={getUsage}
                    getLimit={getLimit}
                    hasRemaining={hasRemaining}
                    entityType="drivers"
                    setModalContent={setModalContent}
                    disabled={isLockedByAdmin}
                    allConstructors={allConstructors}
                />
            </div>
        </div>

        {/* Bottom Actions: Fastest Lap & Submit */}
        <div className="bg-carbon-fiber rounded-lg p-4 md:p-6 ring-1 ring-pure-white/10 flex flex-col md:flex-row items-end gap-4 md:gap-8 border border-pure-white/5">
             {/* Left: Fastest Lap */}
             <div className="w-full md:flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <FastestLapIcon className="w-5 h-5 text-primary-red" />
                    <h3 className="text-lg font-bold text-pure-white">Fastest Lap</h3>
                </div>
                <div className="h-14">
                    <SelectorCard 
                        option={selectedFLDriver}
                        isSelected={!!selectedFLDriver}
                        onClick={openFastestLapModal}
                        placeholder="Select Driver"
                        disabled={isLockedByAdmin}
                        color={flColor}
                        forceColor={!!selectedFLDriver}
                    />
                </div>
            </div>

            {/* Right: Submit Button */}
            <div className="w-full md:flex-1">
                <button
                    type="submit"
                    disabled={!isSelectionComplete() || isLockedByAdmin}
                    className="w-full h-14 flex items-center justify-center gap-3 bg-primary-red hover:opacity-90 text-pure-white font-bold text-xl rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-primary-red/30 disabled:bg-accent-gray disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
                >
                    <SubmitIcon className="w-6 h-6" />
                    Lock In Picks
                </button>
            </div>
        </div>
      </form>

      {/* Footer - Positioned below the form */}
      <div className="mt-12 text-center opacity-30 pb-safe pb-8">
          <F1CarIcon className="w-8 h-8 mx-auto mb-2 text-pure-white" />
          <p className="text-[10px] text-highlight-silver uppercase tracking-widest">Formula Fantasy One © {new Date().getFullYear()}</p>
      </div>
      
      {/* Bottom Sheet / Modal */}
      {modalContent && (
        <div 
          className="fixed inset-0 bg-carbon-black/80 flex items-end md:items-center justify-center z-[999] md:p-4 pb-safe md:pb-4" 
          onClick={() => setModalContent(null)}
        >
          <div 
            className="bg-carbon-fiber rounded-t-2xl md:rounded-lg w-full md:max-w-3xl max-h-[85vh] md:max-h-[80vh] overflow-y-auto animate-slide-up shadow-2xl ring-1 ring-pure-white/10 border border-pure-white/10" 
            onClick={(e) => e.stopPropagation()}
          >
              {/* Drag Handle for Mobile */}
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
}

export const SelectorCard: React.FC<SelectorCardProps> = ({ option, isSelected, onClick, isDropdown, options, onSelect, placeholder, usage, disabled, color, forceColor }) => {
    
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const showColor = (isSelected || forceColor) && color;

    const cardStyle: React.CSSProperties = showColor ? {
        borderColor: color,
        backgroundColor: hexToRgba(color, isSelected ? 0.25 : 0.1),
        boxShadow: isSelected ? `0 10px 15px -3px ${hexToRgba(color, 0.2)}` : undefined
    } : {};
    
    if (isDropdown && options && onSelect) {
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
                ${isSelected && !color ? 'bg-primary-red/20 border-primary-red shadow-lg shadow-primary-red/20' : ''}
                ${!showColor && !isSelected ? 'bg-carbon-black/50 border-accent-gray hover:border-highlight-silver' : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            <p className={`font-bold text-sm md:text-base leading-tight ${isSelected || forceColor ? 'text-pure-white' : 'text-ghost-white'}`}>
                {option ? option.name : placeholder}
            </p>
            {usage && <p className={`text-[10px] md:text-xs mt-0.5 ${isSelected ? (color ? 'text-pure-white' : 'text-primary-red') : 'text-highlight-silver'}`}>{usage}</p>}
        </div>
    );
};

export default PicksForm;