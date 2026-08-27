import React from 'react';
import { Modal, Chip, teamColor, withAlpha, NUMERIC } from '../ui/index.ts';
import type { Constructor, Driver, PickSelection } from '../../types.ts';

interface LineupReviewProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  picks: PickSelection;
  eventName: string;
  allDrivers: Driver[];
  allConstructors: Constructor[];
  getUsage: (id: string, type: 'teams' | 'drivers') => number;
  getLimit: (entityClass: Constructor['class'], type: 'teams' | 'drivers') => number;
  /** Categories with nothing left to pick, so empty slots are expected rather than a mistake. */
  exhaustedLabels: string[];
}

interface LineRow { label: string; ids: (string | null)[]; type: 'teams' | 'drivers'; countsUsage: boolean }

/**
 * The confirm step. Shows the whole lineup with the budget each pick will consume, so the
 * cost of a submission is visible before it is spent rather than discovered next race.
 */
export const LineupReview: React.FC<LineupReviewProps> = ({
  isOpen, onClose, onConfirm, picks, eventName, allDrivers, allConstructors,
  getUsage, getLimit, exhaustedLabels,
}) => {
  const rows: LineRow[] = [
    { label: 'Class A Teams',   ids: picks.aTeams,        type: 'teams',   countsUsage: true },
    { label: 'Class B Team',    ids: [picks.bTeam],       type: 'teams',   countsUsage: true },
    { label: 'Class A Drivers', ids: picks.aDrivers,      type: 'drivers', countsUsage: true },
    { label: 'Class B Drivers', ids: picks.bDrivers,      type: 'drivers', countsUsage: true },
    { label: 'Fastest Lap',     ids: [picks.fastestLap],  type: 'drivers', countsUsage: false },
  ];

  const nameFor = (id: string, type: 'teams' | 'drivers') =>
    (type === 'teams' ? allConstructors.find(c => c.id === id) : allDrivers.find(d => d.id === id))?.name ?? id;

  const emptyCount = rows
    .filter(r => r.countsUsage)
    .reduce((n, r) => n + r.ids.filter(id => !id).length, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Lineup"
      size="md"
      footer={
        <>
          <button type="button" onClick={onClose}
            className="text-highlight-silver hover:text-pure-white font-bold py-2.5 px-4 rounded-lg text-sm transition-colors">
            Keep Editing
          </button>
          <button type="button" onClick={onConfirm}
            className="bg-primary-red hover:opacity-90 text-pure-white font-bold py-2.5 px-6 rounded-lg text-sm shadow-lg shadow-primary-red/20 transition-opacity">
            {emptyCount > 0 ? 'Lock In Partial Lineup' : 'Lock In Picks'}
          </button>
        </>
      }
    >
      <p className="text-sm text-highlight-silver mb-4">
        Your lineup for the <span className="text-pure-white font-bold">{eventName}</span>. You can
        edit it until lights out.
      </p>

      <div className="space-y-3">
        {rows.map(row => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10px] uppercase tracking-wider text-highlight-silver font-bold">
                {row.label}
              </span>
              {!row.countsUsage && <Chip label="No usage cost" tone="neutral" size="xs" />}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {row.ids.map((id, i) => {
                if (!id) {
                  return (
                    <span key={i}
                      className="text-[11px] italic text-highlight-silver/50 border border-dashed border-pure-white/15 rounded-md px-2 py-1">
                      empty — scores 0
                    </span>
                  );
                }
                const entity = row.type === 'teams'
                  ? allConstructors.find(c => c.id === id)
                  : allDrivers.find(d => d.id === id);
                const color = teamColor(
                  row.type === 'teams' ? id : (entity as Driver | undefined)?.constructorId,
                  allConstructors
                );
                const used = getUsage(id, row.type);
                const limit = entity ? getLimit(entity.class, row.type) : 0;

                return (
                  <span key={i}
                    style={color ? { borderColor: withAlpha(color, 0.5), backgroundColor: withAlpha(color, 0.12) } : undefined}
                    className="inline-flex items-center gap-2 rounded-md border border-pure-white/10 px-2.5 py-1.5">
                    <span className="text-xs font-bold text-pure-white">{nameFor(id, row.type)}</span>
                    {row.countsUsage && (
                      <span className={`text-[10px] text-highlight-silver/80 ${NUMERIC}`}>
                        {used} → {used + 1} / {limit}
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {emptyCount > 0 && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-bold text-amber-200">
            {emptyCount} empty {emptyCount === 1 ? 'slot' : 'slots'} — {emptyCount === 1 ? 'it scores' : 'they score'} 0 points.
          </p>
          {exhaustedLabels.length > 0 && (
            <p className="text-[11px] text-amber-300/80 mt-1">
              You have used every available pick for: {exhaustedLabels.join(', ')}.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};
