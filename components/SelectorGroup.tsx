
import React from 'react';
import { EntityClass } from '../types.ts';
import { SelectorCard } from './PicksForm.tsx';
import { TeamIcon } from './icons/TeamIcon.tsx';
import { DriverIcon } from './icons/DriverIcon.tsx';

interface SelectorGroupProps {
  title: string;
  slots: number;
  options: { id: string; name: string; class: EntityClass }[];
  selected: (string | null)[];
  onSelect: (value: string | null, index: number) => void;
  getUsage: (id: string, type: 'teams' | 'drivers') => number;
  getLimit: (entityClass: EntityClass, type: 'teams' | 'drivers') => number;
  hasRemaining: (id: string, type: 'teams' | 'drivers') => boolean;
  entityType: 'teams' | 'drivers';
  setModalContent: (content: React.ReactNode | null) => void;
  disabled?: boolean;
}

const SelectorGroup: React.FC<SelectorGroupProps> = ({ title, slots, options, selected, onSelect, getUsage, getLimit, hasRemaining, entityType, setModalContent, disabled }) => {
  
  const entityClass = options[0]?.class || EntityClass.A;
  const limit = getLimit(entityClass, entityType);

  const openModal = (index: number) => {
    if (disabled) return;
    const placeholderText = title.endsWith('s') ? title.slice(0, -1) : title;
    const modalBody = (
      <div className="p-6">
        <h4 className="text-2xl font-bold mb-4">Select {placeholderText}</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {options.map(option => {
            const isSelected = selected.includes(option.id);
            const canSelect = hasRemaining(option.id, entityType);
            const isModalOptionDisabled = isSelected || !canSelect;
            const usageCount = getUsage(option.id, entityType);
            
            const handleSelect = () => {
              if (isModalOptionDisabled) return;
              onSelect(option.id, index);
              setModalContent(null);
            };
            
            return (
              <div
                key={option.id}
                onClick={handleSelect}
                className={`
                  option-card flex flex-col items-center justify-center text-center gap-1 h-28 rounded-xl px-4
                  transition-all
                  ${isModalOptionDisabled ? 'bg-accent-gray opacity-40 cursor-not-allowed border-2 border-transparent' : 'bg-carbon-black border-2 border-accent-gray hover:border-primary-red cursor-pointer'}
                `}
              >
                <span className="option-label font-semibold whitespace-normal break-words">{option.name}</span>
                <span className="option-usage text-xs opacity-70 leading-none">{usageCount} / {limit} used</span>
                {!canSelect && <span className="text-xs text-primary-red mt-1">Limit Reached</span>}
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
    <div className="bg-accent-gray/50 backdrop-blur-sm rounded-lg p-4 ring-1 ring-pure-white/10">
      <h3 className="text-lg font-bold text-pure-white mb-3 flex items-center gap-2">
        <Icon className={`w-5 h-5 ${entityClass === EntityClass.A ? 'text-primary-red' : 'text-highlight-silver'}`} />
        {title} <span className="text-highlight-silver font-normal text-sm">({slots} required)</span>
      </h3>
      <div className={`grid ${gridLayoutClass} gap-3`}>
        {Array.from({ length: slots }).map((_, index) => {
          const selectedId = selected[index];
          const selectedOption = options.find(o => o.id === selectedId);
          const usage = selectedOption ? `${getUsage(selectedOption.id, entityType)} / ${limit} used` : '';
          const placeholderText = entityType === 'teams' ? 'Team' : 'Driver';
          
          return (
            <SelectorCard
              key={index}
              option={selectedOption || null}
              isSelected={!!selectedOption}
              onClick={() => openModal(index)}
              placeholder={placeholderText}
              usage={usage}
              disabled={disabled}
            />
          );
        })}
      </div>
    </div>
  );
};

export default SelectorGroup;
