import React from 'react';
import { Tile, Chip, NUMERIC } from '../ui/index.ts';
import { TrophyIcon } from '../icons/TrophyIcon.tsx';
import { EyeIcon } from '../icons/EyeIcon.tsx';
import { CategoryBreakdown } from './CategoryBreakdown.tsx';
import { pointsOf, type ProcessedUser } from './utils.ts';

/**
 * The podium.
 *
 * Gold appears here on P1 and nowhere else in the application. The old dashboard spent
 * amber on P1, P3, the sprint category, the "next in line" row, half the modal, and the
 * radar button — which left the champion looking like everything else. One use, one meaning.
 */

interface CardProps {
  user: ProcessedUser;
  leaderPoints: number;
  isYou: boolean;
  onInspect: (user: ProcessedUser) => void;
}

const InspectButton: React.FC<{ onClick: () => void; label: string; className?: string }> = ({
  onClick, label, className = '',
}) => (
  <button
    onClick={onClick}
    className={`mt-3 w-full py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 ${className}`}
  >
    <EyeIcon className="w-3.5 h-3.5" />
    <span>{label}</span>
  </button>
);

export const ChampionCard: React.FC<CardProps & { runnerUpPoints: number }> = ({
  user, isYou, runnerUpPoints, onInspect,
}) => {
  const lead = pointsOf(user) - runnerUpPoints;

  return (
    <Tile
      padding="md"
      className="order-1 md:order-2 flex flex-col justify-between border-amber-400/60 bg-gradient-to-b from-amber-400/[0.07] to-transparent shadow-[0_0_30px_rgba(251,191,36,0.12)]"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-9 h-9 rounded-lg bg-amber-400 text-carbon-black flex items-center justify-center text-base font-black ${NUMERIC} shrink-0`}>
              1
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">
                  Championship Leader
                </span>
                {isYou && <Chip label="You" tone="neutral" size="xs" />}
              </div>
              <h3 className="text-lg font-black text-pure-white truncate">{user.displayName}</h3>
            </div>
          </div>
          <TrophyIcon className="w-5 h-5 text-amber-400 shrink-0" />
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <span className={`block text-4xl font-black leading-none text-amber-400 ${NUMERIC}`}>
              {pointsOf(user).toLocaleString()}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-highlight-silver">
              Points
            </span>
          </div>
          <span className={`text-sm font-black text-amber-400/90 ${NUMERIC} pb-0.5`}>
            +{lead} <span className="text-[10px] font-bold uppercase text-highlight-silver">lead</span>
          </span>
        </div>

        <CategoryBreakdown user={user} className="mt-4" />
      </div>

      <InspectButton
        onClick={() => onInspect(user)}
        label="Inspect Champion"
        className="bg-amber-400 text-carbon-black hover:bg-amber-300"
      />
    </Tile>
  );
};

export const PodiumCard: React.FC<CardProps & { position: 2 | 3 }> = ({
  user, leaderPoints, isYou, position, onInspect,
}) => (
  <Tile
    padding="md"
    className={`flex flex-col justify-between ${position === 2 ? 'order-2 md:order-1' : 'order-3'} ${
      isYou ? 'ring-1 ring-inset ring-pure-white/25' : ''
    }`}
  >
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-8 h-8 rounded-lg bg-pure-white/10 border border-pure-white/20 text-pure-white flex items-center justify-center text-sm font-black ${NUMERIC} shrink-0`}>
            {position}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-highlight-silver">
                P{position}
              </span>
              {isYou && <Chip label="You" tone="neutral" size="xs" />}
            </div>
            <h3 className="text-base font-black text-pure-white truncate">{user.displayName}</h3>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <span className={`block text-3xl font-black leading-none text-pure-white ${NUMERIC}`}>
            {pointsOf(user).toLocaleString()}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-highlight-silver">
            Points
          </span>
        </div>
        <span className={`text-sm font-black text-primary-red ${NUMERIC} pb-0.5`}>
          −{leaderPoints - pointsOf(user)}{' '}
          <span className="text-[10px] font-bold uppercase text-highlight-silver">to P1</span>
        </span>
      </div>

      <CategoryBreakdown user={user} className="mt-4" />
    </div>

    <InspectButton
      onClick={() => onInspect(user)}
      label={`Inspect P${position}`}
      className="bg-pure-white/5 border border-pure-white/10 text-highlight-silver hover:bg-pure-white/10 hover:text-pure-white"
    />
  </Tile>
);
