import React from 'react';
import { Tile, Chip, NUMERIC } from '../ui/index.ts';
import { EyeIcon } from '../icons/EyeIcon.tsx';
import { CategoryBar, CategoryStrip } from './CategoryBreakdown.tsx';
import { pointsOf, type ProcessedUser } from './utils.ts';

interface PackRowProps {
  user: ProcessedUser;
  leaderPoints: number;
  cutoffPoints: number;
  isYou: boolean;
  onInspect: (user: ProcessedUser) => void;
}

/**
 * One row of the timing tower, P11 down.
 *
 * The old row hid its category split behind a per-row expand toggle. Showing the
 * composition inline costs six pixels and removes a tap, so the toggle is gone.
 */
export const PackRow: React.FC<PackRowProps> = ({
  user, leaderPoints, cutoffPoints, isYou, onInspect,
}) => {
  const rank = user.rank ?? 0;
  const points = pointsOf(user);
  const gapToCutoff = cutoffPoints - points;

  return (
    <Tile
      padding="sm"
      className={isYou ? 'ring-1 ring-inset ring-pure-white/25 bg-pure-white/[0.06]' : ''}
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-8 h-8 rounded-lg bg-carbon-black border border-pure-white/15 text-highlight-silver flex items-center justify-center text-xs font-black ${NUMERIC} shrink-0`}>
            {rank}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-pure-white truncate">
                {user.displayName}
              </span>
              {isYou && <Chip label="You" tone="neutral" size="xs" />}
            </div>
            <span className={`text-[11px] text-highlight-silver ${NUMERIC}`}>
              {points.toLocaleString()} pts
              <span className="hidden sm:inline"> · −{leaderPoints - points} to P1</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right leading-tight">
            <span
              className={`block text-sm font-black ${NUMERIC} ${
                gapToCutoff <= 0 ? 'text-green-400' : 'text-pure-white'
              }`}
            >
              {gapToCutoff <= 0 ? 'Top 10' : `−${gapToCutoff}`}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-highlight-silver">
              to P10
            </span>
          </div>
          <button
            onClick={() => onInspect(user)}
            aria-label={`Inspect ${user.displayName}`}
            className="p-2 rounded-lg bg-pure-white/5 border border-pure-white/10 text-highlight-silver hover:bg-primary-red hover:border-primary-red hover:text-pure-white transition-colors"
          >
            <EyeIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      <CategoryBar user={user} className="mt-2.5 sm:hidden" />
      <CategoryStrip user={user} className="mt-2.5 hidden sm:grid" />
    </Tile>
  );
};
