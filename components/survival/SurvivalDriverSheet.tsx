import React from 'react';
import { Sheet, NUMERIC, teamColor } from '../ui/index.ts';
import type { Constructor, Driver } from '../../types.ts';
import { SURVIVAL_MAX_USES } from '../../utils/survival.ts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  drivers: Driver[];
  constructors: Constructor[];
  /** Uses already spent per driver, excluding the round being picked. */
  usage: { [driverId: string]: number };
  selectedId: string | null;
  onSelect: (driverId: string) => void;
}

export const SurvivalDriverSheet: React.FC<Props> = ({
  isOpen, onClose, drivers, constructors, usage, selectedId, onSelect,
}) => {
  const active = drivers.filter(d => d.isActive);
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Pick a podium finisher">
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {active.map(d => {
          const left = SURVIVAL_MAX_USES - (usage[d.id] || 0);
          const spent = left <= 0;
          const team = constructors.find(c => c.id === d.constructorId);
          const selected = d.id === selectedId;
          return (
            <li key={d.id}>
              <button
                type="button"
                disabled={spent}
                onClick={() => onSelect(d.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  selected ? 'border-primary-red bg-primary-red/10' : 'border-pure-white/10 bg-accent-gray/40 hover:border-pure-white/30'
                } ${spent ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="h-6 w-1 flex-none rounded-full" style={{ backgroundColor: teamColor(d.constructorId, constructors) }} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-pure-white">{d.name}</span>
                    <span className="block truncate text-[11px] text-highlight-silver">{team?.name ?? ''}</span>
                  </span>
                </span>
                <span className={`flex-none text-[11px] font-bold uppercase tracking-wider ${spent ? 'text-highlight-silver' : 'text-pure-white'} ${NUMERIC}`}>
                  {spent ? 'Used up' : `${left} left`}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
};
