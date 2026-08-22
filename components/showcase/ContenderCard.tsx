import React from 'react';
import { Tile, Chip, NUMERIC } from '../ui/index.ts';
import { EyeIcon } from '../icons/EyeIcon.tsx';
import { CategoryBreakdown } from './CategoryBreakdown.tsx';
import { pointsOf, type ProcessedUser } from './utils.ts';

interface ContenderCardProps {
  user: ProcessedUser;
  rank: number;
  leaderPoints: number;
  /** Points held by the principal one position ahead — the gap that is actually closeable. */
  aheadPoints: number;
  isYou: boolean;
  isCutoff: boolean;
  onInspect: (user: ProcessedUser) => void;
}

/** P4 through P10. The gap that matters here is to the car in front, not to the leader. */
export const ContenderCard: React.FC<ContenderCardProps> = ({
  user, rank, leaderPoints, aheadPoints, isYou, isCutoff, onInspect,
}) => {
  const points = pointsOf(user);

  return (
    <Tile
      padding="md"
      className={`flex flex-col justify-between ${isYou ? 'ring-1 ring-inset ring-pure-white/25 bg-pure-white/[0.06]' : ''}`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-7 h-7 rounded-lg bg-carbon-black border border-pure-white/20 text-pure-white flex items-center justify-center text-xs font-black ${NUMERIC} shrink-0`}>
              {rank}
            </span>
            <span className="text-sm font-black text-pure-white truncate">{user.displayName}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isYou && <Chip label="You" tone="neutral" size="xs" />}
            {isCutoff && <Chip label="Cutoff" tone="success" size="xs" />}
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <span className={`block text-2xl font-black leading-none text-pure-white ${NUMERIC}`}>
              {points.toLocaleString()}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-highlight-silver">
              Points
            </span>
          </div>
          <div className="text-right leading-tight">
            <span className={`block text-sm font-black text-pure-white ${NUMERIC}`}>
              −{aheadPoints - points}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-highlight-silver">
              to P{rank - 1}
            </span>
            <span className={`block text-[10px] text-highlight-silver/70 mt-0.5 ${NUMERIC}`}>
              −{leaderPoints - points} to P1
            </span>
          </div>
        </div>

        <CategoryBreakdown user={user} className="mt-3.5" />
      </div>

      <button
        onClick={() => onInspect(user)}
        className="mt-3 w-full py-2 rounded-lg bg-pure-white/5 border border-pure-white/10 text-highlight-silver hover:bg-primary-red hover:border-primary-red hover:text-pure-white text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
      >
        <EyeIcon className="w-3.5 h-3.5" />
        <span>Inspect</span>
      </button>
    </Tile>
  );
};
