import React from 'react';
import { SlotCard } from './SlotCard.tsx';
import { Chip, teamColor } from '../ui/index.ts';
import type { Constructor, Driver, EntityClass } from '../../types.ts';

type Entity = (Constructor | Driver) & { constructorId?: string };

interface SlotGroupProps {
  title: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  slots: number;
  selected: (string | null)[];
  options: Entity[];
  entityType: 'teams' | 'drivers';
  allConstructors: Constructor[];
  allDrivers: Driver[];
  getUsage: (id: string, type: 'teams' | 'drivers') => number;
  getLimit: (entityClass: EntityClass, type: 'teams' | 'drivers') => number;
  onOpenSlot: (index: number) => void;
  onClearSlot: (index: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  /** Every option for this group is spent; empty slots are allowed and score zero. */
  isExhausted?: boolean;
}

export const SlotGroup: React.FC<SlotGroupProps> = ({
  title, icon: Icon, slots, selected, options, entityType, allConstructors, allDrivers,
  getUsage, getLimit, onOpenSlot, onClearSlot, disabled, readOnly, isExhausted,
}) => {
  const placeholder = entityType === 'teams' ? 'Team' : 'Driver';
  const filledCount = selected.filter(Boolean).length;

  const lookup = (id: string): Entity | undefined =>
    (entityType === 'teams' ? allConstructors : allDrivers).find(e => e.id === id) as Entity | undefined;

  return (
    <div className="rounded-xl border border-pure-white/10 bg-accent-gray/30 p-3 md:p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon className="w-4 h-4 text-primary-red shrink-0" />}
          <h3 className="text-sm font-bold text-pure-white uppercase tracking-wide truncate">{title}</h3>
          <span className="text-[10px] text-highlight-silver/70 font-mono tabular-nums shrink-0">
            {filledCount}/{slots}
          </span>
        </div>
        {isExhausted && <Chip label="Limits reached" tone="warning" size="xs" />}
      </div>

      <div className={`grid gap-2.5 ${slots >= 3 ? 'grid-cols-1 sm:grid-cols-3' : slots === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
        {Array.from({ length: slots }).map((_, i) => {
          const id = selected[i];
          const entity = id ? lookup(id) : undefined;
          const color = teamColor(
            entityType === 'drivers' ? entity?.constructorId : entity?.id,
            allConstructors
          );
          const subtitle = entityType === 'drivers' && entity?.constructorId
            ? allConstructors.find(c => c.id === entity.constructorId)?.name
            : undefined;

          return (
            <SlotCard
              key={i}
              name={entity?.name}
              subtitle={subtitle}
              color={color}
              placeholder={placeholder}
              used={entity ? getUsage(entity.id, entityType) : undefined}
              limit={entity ? getLimit(entity.class, entityType) : undefined}
              onClick={() => onOpenSlot(i)}
              onClear={() => onClearSlot(i)}
              disabled={disabled}
              readOnly={readOnly}
            />
          );
        })}
      </div>

      {isExhausted && filledCount < slots && (
        <p className="text-[11px] text-amber-400/80 mt-2.5 leading-snug">
          No options left for this group. Empty slots are allowed and score 0 points for this race.
        </p>
      )}
    </div>
  );
};
