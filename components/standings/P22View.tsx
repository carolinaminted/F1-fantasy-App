import React, { useMemo } from 'react';
import { Tile, StatTile, SectionHeader, EmptyState, Chip, NUMERIC } from '../ui/index.ts';
import { TrashIcon } from '../icons/TrashIcon.tsx';
import { TrophyIcon } from '../icons/TrophyIcon.tsx';
import { ProfileIcon } from '../icons/ProfileIcon.tsx';
import type { User } from '../../types.ts';

interface P22ViewProps {
  users: User[];
  currentUser: User | null;
}

/**
 * The Wall of Shame — who most often picked the driver who finished last.
 *
 * Opens with the league-wide picture and, crucially, the reader's own count. The old
 * version was a leaderboard of other people; the number you actually care about is yours.
 */
export const P22View: React.FC<P22ViewProps> = ({ users, currentUser }) => {
  const { ranked, leagueTotal, worst, yours, yourRank } = useMemo(() => {
    const withP22 = users.filter(u => (u.breakdown?.p22 ?? 0) > 0);
    const sorted = [...withP22].sort((a, b) => (b.breakdown!.p22 || 0) - (a.breakdown!.p22 || 0));
    const total = users.reduce((n, u) => n + (u.breakdown?.p22 ?? 0), 0);
    const you = currentUser ? users.find(u => u.id === currentUser.id) : undefined;
    const yourCount = you?.breakdown?.p22 ?? 0;
    const idx = sorted.findIndex(u => u.id === currentUser?.id);
    return {
      ranked: sorted.slice(0, 10),
      leagueTotal: total,
      worst: sorted[0],
      yours: yourCount,
      yourRank: idx >= 0 ? idx + 1 : null,
    };
  }, [users, currentUser]);

  return (
    <div className="flex flex-col md:h-full animate-fade-in pb-24 md:pb-safe pt-1 md:overflow-y-auto custom-scrollbar pr-1">
      <SectionHeader
        title="The Wall of Shame"
        subtitle="Principals who picked the last-place finisher most often"
        icon={TrashIcon}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatTile label="League P22 Picks" value={leagueTotal} unit="total" icon={TrashIcon} />
        <StatTile
          label="Worst Offender"
          value={worst?.breakdown?.p22 ?? '—'}
          unit={worst ? 'times' : undefined}
          deltaLabel={worst?.displayName}
          icon={TrophyIcon}
        />
        <StatTile
          label="Your Count"
          value={yours}
          unit={yours === 1 ? 'time' : 'times'}
          deltaLabel={yourRank ? `#${yourRank} on the wall` : 'clean sheet'}
          icon={ProfileIcon}
          accent={yours > 0 ? 'gp' : undefined}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {ranked.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ranked.map((user, idx) => {
            const isYou = user.id === currentUser?.id;
            return (
              <Tile
                key={user.id}
                padding="md"
                className={isYou ? 'ring-1 ring-inset ring-pure-white/25 bg-pure-white/[0.07]' : ''}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-7 text-center text-xl font-black ${NUMERIC} ${idx === 0 ? 'text-primary-red' : 'text-highlight-silver'}`}>
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-pure-white truncate">
                          {user.displayName || 'Unknown'}
                        </span>
                        {isYou && <Chip label="You" tone="neutral" size="xs" />}
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-highlight-silver">
                        Rank #{user.rank ?? '—'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`block text-3xl font-black leading-none ${NUMERIC} text-primary-red/85`}>
                      {user.breakdown?.p22}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-highlight-silver">
                      Times
                    </span>
                  </div>
                </div>
              </Tile>
            );
          })}
        </div>
      ) : (
        <Tile padding="none">
          <EmptyState
            icon={TrashIcon}
            title="Nobody on the wall"
            description="No one has picked the last-place finisher yet. Give it time."
          />
        </Tile>
      )}
    </div>
  );
};
