import React, { useMemo, useState } from 'react';
import { Sheet, Meter, Chip, teamColor, withAlpha } from '../ui/index.ts';
import type { Constructor, Driver, EntityClass } from '../../types.ts';

type Entity = (Constructor | Driver) & { constructorId?: string };

interface OptionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: Entity[];
  entityType: 'teams' | 'drivers';
  /** Ids already used by other slots in the same group. */
  takenIds: string[];
  /** The value currently in this slot, which stays selectable. */
  currentId: string | null;
  allConstructors: Constructor[];
  getUsage: (id: string, type: 'teams' | 'drivers') => number;
  getLimit: (entityClass: EntityClass, type: 'teams' | 'drivers') => number;
  hasRemaining: (id: string, type: 'teams' | 'drivers') => boolean;
  onSelect: (id: string) => void;
}

/**
 * Bottom sheet on mobile, centered panel on desktop. Every option shows its own season
 * budget, and anything unavailable says why on the card rather than failing at submit.
 */
export const OptionSheet: React.FC<OptionSheetProps> = ({
  isOpen, onClose, title, options, entityType, takenIds, currentId,
  allConstructors, getUsage, getLimit, hasRemaining, onSelect,
}) => {
  const [query, setQuery] = useState('');

  const teamNameFor = (o: Entity): string | undefined => {
    const id = entityType === 'drivers' ? o.constructorId : o.id;
    if (!id) return undefined;
    return allConstructors.find(c => c.id === id)?.name;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      o.name.toLowerCase().includes(q) || (teamNameFor(o) ?? '').toLowerCase().includes(q)
    );
  }, [query, options, allConstructors, entityType]);

  const handleClose = () => { setQuery(''); onClose(); };

  return (
    <Sheet isOpen={isOpen} onClose={handleClose} title={title}>
      {options.length > 8 && (
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={entityType === 'drivers' ? 'Search drivers or teams…' : 'Search teams…'}
          className="w-full mb-4 bg-carbon-black/70 border border-pure-white/10 rounded-lg px-3 py-2.5 text-sm text-pure-white placeholder:text-highlight-silver/50 focus:outline-none focus:border-primary-red/60"
        />
      )}

      <div className={`grid gap-3 ${entityType === 'drivers' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-3'}`}>
        {filtered.map(option => {
          const color = teamColor(
            entityType === 'drivers' ? option.constructorId : option.id,
            allConstructors
          );
          const used = getUsage(option.id, entityType);
          const limit = getLimit(option.class, entityType);
          const isCurrent = option.id === currentId;
          const isTaken = takenIds.includes(option.id) && !isCurrent;
          const exhausted = !hasRemaining(option.id, entityType) && !isCurrent;
          const unavailable = isTaken || exhausted;

          const reason = isTaken ? 'Already picked' : exhausted ? 'Limit reached' : null;

          return (
            <button
              key={option.id}
              type="button"
              disabled={unavailable}
              onClick={() => { if (!unavailable) { onSelect(option.id); handleClose(); } }}
              style={!unavailable && color ? {
                borderColor: withAlpha(color, 0.6),
                backgroundColor: withAlpha(color, 0.12),
              } : undefined}
              className={[
                'rounded-xl border p-3 text-left transition-all duration-200',
                unavailable
                  ? 'border-pure-white/10 bg-carbon-black/40 opacity-45 cursor-not-allowed'
                  : 'hover:scale-[1.02] cursor-pointer',
                isCurrent ? 'ring-2 ring-pure-white/40' : '',
              ].filter(Boolean).join(' ')}
            >
              <div className="font-bold text-sm text-pure-white leading-tight">{option.name}</div>
              {entityType === 'drivers' && (
                <div className="text-[10px] uppercase tracking-wider text-highlight-silver/80 mt-0.5 truncate">
                  {teamNameFor(option)}
                </div>
              )}

              <Meter value={used} max={limit} color={color} size="sm" className="mt-2.5" />
              <div className="mt-1 flex items-center justify-between gap-1">
                <span className="text-[10px] text-highlight-silver/80 font-mono tabular-nums">
                  {Math.max(0, limit - used)} left
                </span>
                {isCurrent && <Chip label="Current" tone="neutral" size="xs" />}
              </div>

              {reason && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-primary-red mt-1.5">
                  {reason}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-highlight-silver text-center py-8">
          Nothing matches “{query}”.
        </p>
      )}
    </Sheet>
  );
};
