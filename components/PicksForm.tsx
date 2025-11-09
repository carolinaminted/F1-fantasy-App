import React, { useState, useEffect, useCallback } from 'react';
import { PickSelection, EntityClass, Event, Constructor, Driver, User } from '../types';
import CountdownTimer from './CountdownTimer';
import SelectorGroup from './SelectorGroup';
import { SubmitIcon } from './icons/SubmitIcon';
import { FastestLapIcon } from './icons/FastestLapIcon';

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
  aTeams: Constructor[];
  bTeams: Constructor[];
  aDrivers: Driver[];
  bDrivers: Driver[];
  allDrivers: Driver[];
  getUsage: (id: string, type: 'teams' | 'drivers') => number;
  getLimit: (entityClass: EntityClass, type: 'teams' | 'drivers') => number;
  hasRemaining: (id: string, type: 'teams' | 'drivers') => boolean;
}

const PicksForm: React.FC<PicksFormProps> = ({
  user,
  event,
  initialPicksForEvent,
  onPicksSubmit,
  aTeams,
  bTeams,
  aDrivers,
  bDrivers,
  allDrivers,
  getUsage,
  getLimit,
  hasRemaining
}) => {
  const [picks, setPicks] = useState<PickSelection>(initialPicksForEvent || getInitialPicks());
  const [isEditing, setIsEditing] = useState<boolean>(!initialPicksForEvent);
  const [modalContent, setModalContent] = useState<React.ReactNode | null>(null);

  const isSubmitted = !!initialPicksForEvent;

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

  if(!isEditing) {
    return (
        <div className="max-w-4xl mx-auto text-center bg-gray-800/50 backdrop-blur-sm rounded-lg p-8 ring-1 ring-green-400/30">
            <h2 className="text-3xl font-bold text-green-400 mb-4">Picks Submitted Successfully!</h2>
            <p className="text-gray-300">Your picks for the {event.name} are locked in. Good luck, {user.displayName}!</p>
            <button onClick={() => setIsEditing(true)} className="mt-6 bg-[#ff8400] hover:bg-orange-500 text-white font-bold py-2 px-6 rounded-lg">
                Edit Picks
            </button>
        </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-8">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-white/10 flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex-grow text-center">
            <div className="flex flex-wrap justify-center items-baseline gap-x-3 gap-y-1">
              <h2 className="text-3xl font-bold text-white">{event.name}</h2>
              {isSubmitted ? (
                <span className="text-xs font-bold uppercase tracking-wider bg-green-500/20 text-green-400 px-3 py-1 rounded-full">Submitted</span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full">Unsubmitted</span>
              )}
            </div>
            <p className="text-gray-400 mt-1">Round {event.round} - {event.country}</p>
          </div>
          <CountdownTimer event={event} />
        </div>

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
        />

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
        />
        
         <div className="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 ring-1 ring-white/10">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <FastestLapIcon className="w-6 h-6 text-[#94d600]" />
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
                      placeholder="Select Fastest Lap Driver"
                  />
              </div>
         </div>


        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={!isSelectionComplete()}
            className="flex items-center gap-2 bg-[#ff8400] hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-orange-500/20 disabled:bg-gray-600 disabled:shadow-none disabled:cursor-not-allowed disabled:scale-100"
          >
            <SubmitIcon className="w-5 h-5" />
            Lock In Picks
          </button>
        </div>
      </form>
      {modalContent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[999] p-4" onClick={() => setModalContent(null)}>
          <div className="bg-gray-800 rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
}

export const SelectorCard: React.FC<SelectorCardProps> = ({ option, isSelected, onClick, isDropdown, options, onSelect, placeholder, usage, disabled }) => {
    if (isDropdown && options && onSelect) {
        return (
            <div className="relative">
                <select
                    value={option?.id || ''}
                    onChange={(e) => onSelect(e.target.value || null)}
                    className="w-full bg-gray-900/70 border border-gray-700 rounded-md shadow-sm py-3 px-4 text-white focus:outline-none focus:ring-[#ff8400] focus:border-[#ff8400] appearance-none"
                >
                    <option value="">{placeholder}</option>
                    {options.map(opt => (
                        <option key={opt.id} value={opt.id} disabled={disabled || (usage?.includes('0') && opt.id !== option?.id)}>
                            {opt.name}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
            </div>
        );
    }
    
    return (
        <div 
            onClick={disabled ? undefined : onClick}
            className={`
                p-4 rounded-lg border-2 flex flex-col justify-center items-center h-full text-center
                transition-all duration-200
                ${isSelected ? 'bg-[#0091b3]/20 border-[#0091b3] shadow-lg shadow-[#0091b3]/20' : 'bg-gray-900/50 border-gray-700 hover:border-gray-500'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            <p className={`font-bold text-lg ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                {option ? option.name : placeholder}
            </p>
            {usage && <p className={`text-sm mt-1 ${isSelected ? 'text-cyan-300' : 'text-gray-400'}`}>{usage}</p>}
        </div>
    );
};

export default PicksForm;