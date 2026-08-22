import React, { useState } from 'react';
import { Tile, SectionHeader, Meter, NUMERIC } from '../ui/index.ts';
import { ChevronDownIcon } from '../icons/ChevronDownIcon.tsx';
import { GarageIcon } from '../icons/GarageIcon.tsx';

export interface UsageEntity {
  id: string;
  name: string;
  color?: string;
}

interface UsageListProps {
  title: string;
  entities: UsageEntity[];
  usageData: { [id: string]: number };
  limit: number;
  onItemClick: (id: string, name: string) => void;
}

const UsageList: React.FC<UsageListProps> = ({ title, entities, usageData, limit, onItemClick }) => {
  const [isOpen, setIsOpen] = useState(false);

  const sorted = [...entities].sort((a, b) => {
    const ua = usageData[a.id] || 0;
    const ub = usageData[b.id] || 0;
    if (ua !== ub) return ub - ua;
    return a.name.localeCompare(b.name);
  });

  const spent = sorted.reduce((n, e) => n + (usageData[e.id] || 0), 0);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-pure-white/5"
      >
        <span className="text-sm font-black uppercase tracking-wider text-pure-white">{title}</span>
        <span className="flex items-center gap-2">
          <span className={`text-[11px] text-highlight-silver ${NUMERIC}`}>{spent} used</span>
          <ChevronDownIcon className={`w-5 h-5 text-highlight-silver transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {isOpen && (
        <div className="mt-2 space-y-2.5">
          {sorted.map(e => (
            <button
              key={e.id}
              onClick={() => onItemClick(e.id, e.name)}
              className="group -mx-1.5 w-full rounded-lg p-1.5 text-left transition-colors hover:bg-pure-white/5 focus:outline-none focus:ring-1 focus:ring-pure-white/20"
            >
              <Meter
                label={e.name}
                value={usageData[e.id] || 0}
                max={limit}
                color={e.color}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

interface UsageSectionProps {
  lists: UsageListProps[];
}

/**
 * Season selection budgets. Each bar carries the team color; tapping a row opens the
 * usage history for that entity. The budgets themselves come from `getLimit` upstream —
 * nothing here re-derives a league rule.
 */
export const UsageSection: React.FC<UsageSectionProps> = ({ lists }) => (
  <div>
    <SectionHeader
      title="Selection Counts"
      subtitle="Season budget spent per team and driver"
      icon={GarageIcon}
    />
    <Tile padding="md">
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
        {lists.map(list => <UsageList key={list.title} {...list} />)}
      </div>
    </Tile>
  </div>
);
