
import React from 'react';
import { EntityClass, Constructor } from '../types.ts';
import { SelectorCard } from './PicksForm.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';
import { CONSTRUCTORS } from '../constants.ts';

interface SelectorGroupProps {
  title: string;
  slots: number;
  options: { id: string; name: string; class: EntityClass; constructorId?: string }[];
  selected: (string | null)[];
  onSelect: (value: string | null, index: number) => void;
  getUsage: (id: string, type: 'teams' | 'drivers') => number;
  getLimit: (entityClass: EntityClass, type: 'teams' | 'drivers') => number;
  hasRemaining: (id: string, type: 'teams' | 'drivers') => boolean;
  entityType: 'teams' | 'drivers';
  setModalContent: (content: React.ReactNode | null) => void;
  disabled?: boolean;
  allConstructors: Constructor[];
}

// Helper to add alpha to hex for background
const hexToRgba = (hex: string, alpha: number) => {
    // Basic hex parsing
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const SelectorGroup: React.FC<SelectorGroupProps> = ({ title, slots, options, selected, onSelect, getUsage, getLimit, hasRemaining, entityType, setModalContent, disabled, allConstructors }) => {
  
  const entityClass = options[0]?.class || EntityClass.A;
  const limit = getLimit(entityClass, entityType);

  // Helper to find color with fallback to constants
  const getColor = (optionId: string): string | undefined => {
    let color: string | undefined;
    
    if (entityType === 'teams') {
       color = allConstructors.find(c => c.id === optionId)?.color;
       // Fallback to constants if DB record is stale/missing color
       if (!color) color = CONSTRUCTORS.find(c => c.id === optionId)?.color;
    } else {
       // For drivers, find their constructor first
       const driver = options.find(d => d.id === optionId);
       if (driver?.constructorId) {
           color = allConstructors.find(c => c.id === driver.constructorId)?.color;
           if (!color) color = CONSTRUCTORS.find(c => c.id === driver.constructorId)?.color;
       }
    }
    return color;
  };

  const openModal = (index: number) => {
    if (disabled) return;
    const placeholderText = title.endsWith('s') ? title.slice(0, -1) : title;
    
    // Drivers get 4 columns, Teams get 3 columns on desktop
    const gridCols = entityType === 'drivers' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3';

    const modalBody = (
      <div className="p-6">
        <h4 className="text-2xl font-bold mb-4">Select {placeholderText}</h4>
        <div className={`grid ${gridCols} gap-4`}>
          {options.map(option => {
            const isSelected = selected.includes(option.id);
            const canSelect = hasRemaining(option.id, entityType);
            const isModalOptionDisabled = isSelected || !canSelect;
            const usageCount = getUsage(option.id, entityType);
            const color = getColor(option.id);
            
            const handleSelect = () => {
              if (isModalOptionDisabled) return;
              onSelect(option.id, index);
              setModalContent(null);
            };
            
            return (
              <div
                key={option.id}
                onClick={handleSelect}
                style={{
                  borderColor: !isModalOptionDisabled && color ? color : undefined,
                  backgroundColor: !isModalOptionDisabled && color ? hexToRgba(color, 0.15) : undefined,
                  boxShadow: !isModalOptionDisabled && color ? `0 4px 6px -1px ${hexToRgba(color, 0.1)}` : undefined
                }}
                className={`
                  option-card flex flex-col items-center justify-center text-center gap-1 h-24 rounded-xl px-2 border-2
                  transition-all duration-200
                  ${isModalOptionDisabled ? 'bg-accent-gray opacity-40 cursor-not-allowed border-transparent' : 'bg-carbon-black border-accent-gray hover:border-current cursor-pointer hover:scale-[1.02]'}
                `}
              >
                <span className="option-label font-bold text-sm md:text-base leading-tight">{option.name}</span>
                <span className="option-usage text-xs opacity-70 leading-none mt-1">{usageCount} / {limit} used</span>
                {!canSelect && <span className="text-xs text-primary-red font-bold mt-1">Limit Reached</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
    setModalContent(modalBody);
  };

  const Icon = entityType === 'teams' ? TeamIcon : DriverIcon;

  const gridLayoutClass = slots === 1 ? 'grid-cols-1' :
                          slots === 2 ? 'grid-cols-1 md:grid-cols-2' :
                          'grid-cols-1 md:grid-cols-3';

  return (
    <div className={`bg-carbon-fiber rounded-lg p-3 ring-1 ring-pure-white/10 border border-pure-white/5 transition-opacity duration-200 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <h3 className="text-lg font-bold text-pure-white mb-2 flex items-center gap-2">
        <Icon className={`w-5 h-5 ${entityClass === EntityClass.A ? 'text-primary-red' : 'text-highlight-silver'}`} />
        {title} <span className="text-highlight-silver font-normal text-sm">({slots} required)</span>
      </h3>
      <div className={`grid ${gridLayoutClass} gap-2`}>
        {Array.from({ length: slots }).map((_, index) => {
          const selectedId = selected[index];
          const selectedOption = options.find(o => o.id === selectedId);
          const usage = selectedOption ? `${getUsage(selectedOption.id, entityType)} / ${limit} used` : '';
          const placeholderText = entityType === 'teams' ? 'Team' : 'Driver';
          const color = selectedOption ? getColor(selectedOption.id) : undefined;
          
          return (
            <SelectorCard
              key={index}
              option={selectedOption || null}
              isSelected={!!selectedOption}
              onClick={() => openModal(index)}
              placeholder={placeholderText}
              usage={usage}
              disabled={disabled}
              color={color}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SelectorGroup;
