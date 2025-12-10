
import React, { useState, useEffect, useCallback } from 'react';
import { PickSelection, EntityClass, Event, Constructor, Driver, User } from '../types.ts';
import SelectorGroup from './SelectorGroup.tsx';
import { SubmitIcon } from './icons/SubmitIcon.tsx';
import { FastestLapIcon } from './icons/FastestLapIcon.tsx';
import { LockIcon } from './icons/LockIcon.tsx';
import { CONSTRUCTORS } from '../constants.ts';

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
  allConstructors: Constructor[]; // Need this for color lookups in children
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

  const isSubmitted = !!initialPicksForEvent;
  const isLockedByAdmin = formLocks[event.id] && user.email !== 'admin@fantasy.f1';

  useEffect(() => {
    const savedPicks = initialPicksForEvent;
    setPicks(savedPicks || getInitialPicks());
    setIsEditing(!savedPicks);
  }, [event.id, initialPicksForEvent]);

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
    if(isSelectionComplete()) {
        onPicksSubmit(event.id, picks);
        setIsEditing(false);
    } else {
        alert("Please complete all selections before submitting.");
    }
  };
  
  // Resolve fastest lap color
  const getFastestLapColor = () => {
      if(!picks.fastestLap) return undefined;
      const driver = allDrivers.find(d => d.id === picks.fastestLap);
      if(!driver) return undefined;
      let constructor = allConstructors.find(c => c.id === driver.constructorId);
      // Fallback to constants if color missing
      if (!constructor?.color) {
          constructor = CONSTRUCTORS.find(c => c.id === driver.constructorId);
      }
      return constructor?.color;
  };

  if (isLockedByAdmin && !isEditing) {
    // Show a simplified lock view for non-admins if their picks are already submitted and locked
    // The main form handles the detailed locked view while editing
    return (
        <div className="max-w-4xl mx-auto text-center bg-accent-gray/50 backdrop-blur-sm rounded-lg p-8 ring-1 ring-primary-red/50">
            <LockIcon className="w-12 h-12 text-primary-red mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-ghost-white mb-2">Picks Are Locked</h2>
            <p className="text-ghost-white">Your submitted picks for this event cannot be edited.</p>
        </div>
    );
  }

  const isFormLockedForStatus = formLocks[event.id];
  
  if(!isEditing) {
    return (
        <div className="max-w-4xl mx-auto text-center bg-accent-gray/50 backdrop-blur-sm rounded-lg p-8 ring-1 ring-highlight-silver/30">
            <h2 className="text-3xl font-bold text-ghost-white mb-4">Picks Submitted Successfully!</h2>
            <p className="text-ghost-white">Your picks for the {event.name} are locked in. Good luck, {user.displayName}!</p>
            <button 
              onClick={() => setIsEditing(true)} 
              disabled={isFormLockedForStatus}
              className="mt-6 bg-primary-red hover:opacity-90 text-pure-white font-bold py-2 px-6 rounded-lg disabled:bg-accent-gray disabled:cursor-not-allowed"
            >
              {isFormLockedForStatus ? 'Editing Locked' : 'Edit Picks'}
            </button>
        </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-4">
        <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-4 ring-1 ring-pure-white/10 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex-grow text-center md:text-left">
            <h2 className="text-3xl font-bold text-pure-white">{event.name}</h2>
            <p className="text-highlight-silver mt-1">Round {event.round} - {event.country}</p>
            <div className="mt-2">
              {isSubmitted ? (
                <span className="text-xs font-bold uppercase tracking-wider bg-green-600/80 text-pure-white px-3 py-1 rounded-full">Submitted</span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider bg-accent-gray/50 text-ghost-white px-3 py-1 rounded-full">Unsubmitted</span>
              )}
            </div>
          </div>
          <div className="text-center">
              <p className="text-sm uppercase tracking-wider font-semibold text-highlight-silver">
                  {isFormLockedForStatus ? "Picks Locked" : "Picks Open"}
              </p>
              <p className={`text-3xl font-bold tracking-tighter ${isFormLockedForStatus ? "text-primary-red" : "text-pure-white"}`}>
                  {isFormLockedForStatus ? "LOCKED" : "OPEN"}
              </p>
               <p className="text-xs text-highlight-silver opacity-70">
                  {isFormLockedForStatus ? "Submissions Closed" : "Submissions are available"}
              </p>
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
                    disabled={isFormLockedForStatus}
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
                    disabled={isFormLockedForStatus}
                    allConstructors={allConstructors}
                />
            </div>
            {/* Right Column: Drivers */}
            <div className="space-y-4">
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
                    disabled={isFormLockedForStatus}
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
                    disabled={isFormLockedForStatus}
                    allConstructors={allConstructors}
                />
            </div>
        </div>
        
         <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-3 ring-1 ring-pure-white/10">
              <h3 className="text-lg font-bold text-pure-white mb-2 flex items-center gap-2">
                  <FastestLapIcon className="w-5 h-5 text-primary-red" />
                  Fastest Lap
              </h3>
              <div className="grid grid-cols-1">
                   <SelectorCard
                      option={allDrivers.find(d => d.id === picks.fastestLap) || null}
                      isSelected={!!picks.fastestLap}
                      onClick={() => {}}
                      isDropdown={true}
                      options={allDrivers}
                      onSelect={(value) => handleSelect('fastestLap', value)}
                      placeholder="Driver"
                      disabled={isFormLockedForStatus}
                      color={getFastestLapColor()}
                  />
              </div>
         </div>


        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={!isSelectionComplete() || isFormLockedForStatus}
            className="flex items-center gap-2 bg-primary-red hover:opacity-90 text-pure-white font-bold py-3 px-8 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-primary-red/30 disabled:bg-accent-gray disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
          >
            <SubmitIcon className="w-5 h-5" />
            Lock In Picks
          </button>
        </div>
      </form>
      {modalContent && (
        <div className="fixed inset-0 bg-carbon-black/80 flex items-center justify-center z-[999] p-4" onClick={() => setModalContent(null)}>
          <div className="bg-accent-gray rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {modalContent}
          </div>
        </div>
      )}
    </>
  );
};

// Sub-component for a single selection card
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
}

export const SelectorCard: React.FC<SelectorCardProps> = ({ option, isSelected, onClick, isDropdown, options, onSelect, placeholder, usage, disabled, color }) => {
    
    // Helper to add alpha to hex for background
    const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    const cardStyle: React.CSSProperties = isSelected && color ? {
        borderColor: color,
        backgroundColor: hexToRgba(color, 0.2),
        boxShadow: `0 10px 15px -3px ${hexToRgba(color, 0.2)}`
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
                ${!isSelected ? 'bg-carbon-black/50 border-accent-gray hover:border-highlight-silver' : ''}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            <p className={`font-bold text-sm md:text-base leading-tight ${isSelected ? 'text-pure-white' : 'text-ghost-white'}`}>
                {option ? option.name : placeholder}
            </p>
            {usage && <p className={`text-[10px] md:text-xs mt-0.5 ${isSelected ? (color ? 'text-pure-white' : 'text-primary-red') : 'text-highlight-silver'}`}>{usage}</p>}
        </div>
    );
};

export default PicksForm;
