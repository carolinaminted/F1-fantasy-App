import React, { useMemo, useState } from 'react';
import { Tile, StatTile, SectionHeader, Drawer, EmptyState, NUMERIC } from './ui/index.ts';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { TrendingUpIcon } from './icons/TrendingUpIcon.tsx';
import { LockIcon } from './icons/LockIcon.tsx';
import { GapLadder } from './showcase/GapLadder.tsx';
import { BattleRadar } from './showcase/BattleRadar.tsx';
import { isSameUser, pointsOf, type ProcessedUser } from './showcase/utils.ts';
import type { User } from '../types.ts';

interface ExecutiveDashboardViewProps {
  users: ProcessedUser[];
  currentUser: User | null;
  onSelectUser: (user: ProcessedUser) => void;
}

/**
 * The Battle Zone — the championship read as intervals, not positions.
 *
 * Rebuilt in Gate 10 on the shared kit, then rethought after review: the podium-and-grid
 * layout answered "who is where", which the race track already does. This page answers the
 * question members actually bring to it — *how close is the car ahead, and who is closing
 * from behind* — so the whole field renders as one gap ladder (see GapLadder), with a
 * per-principal drawer for the deeper radar view. Everything is derived from the standings
 * already on the page; no additional Firestore reads.
 */
export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  users, currentUser, onSelectUser,
}) => {
  const [radarSubject, setRadarSubject] = useState<ProcessedUser | null>(null);
  const [radarOpen, setRadarOpen] = useState(false);

  const leader = users[0] ?? null;
  const runnerUp = users[1] ?? null;

  const you = useMemo(
    () => users.find(u => isSameUser(u, currentUser)) ?? null,
    [users, currentUser]
  );
  const youIndex = you ? users.findIndex(u => u.id === you.id) : -1;
  const youAhead = youIndex > 0 ? users[youIndex - 1] : null;
  const youBehind = youIndex >= 0 && youIndex < users.length - 1 ? users[youIndex + 1] : null;

  // The single tightest interval anywhere on the road — the league's hottest battle.
  const tightest = useMemo(() => {
    let best: { gap: number; ahead: ProcessedUser; behind: ProcessedUser } | null = null;
    for (let i = 1; i < users.length; i++) {
      const gap = pointsOf(users[i - 1]) - pointsOf(users[i]);
      if (!best || gap < best.gap) best = { gap, ahead: users[i - 1], behind: users[i] };
    }
    return best;
  }, [users]);

  const openRadar = () => {
    setRadarSubject(you ?? users[0] ?? null);
    setRadarOpen(true);
  };

  const inspectFromRadar = (user: ProcessedUser) => {
    setRadarOpen(false);
    onSelectUser(user);
  };

  if (users.length === 0) {
    return (
      <Tile padding="none">
        <EmptyState
          icon={TrophyIcon}
          title="No standings yet"
          description="Once the first race is scored, the championship shows up here."
        />
      </Tile>
    );
  }

  return (
    <div className="flex flex-col md:h-full animate-fade-in pb-24 md:pb-safe pt-1 md:overflow-y-auto custom-scrollbar pr-1">
      <SectionHeader
        title="The Battle Board"
        subtitle="Every interval on the road — tap a principal to break the gap down"
        icon={F1CarIcon}
        action={
          <button
            onClick={openRadar}
            className="flex items-center gap-2 rounded-lg bg-primary-red px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-pure-white transition-colors hover:bg-red-600 active:scale-95"
          >
            <F1CarIcon className="w-4 h-4" />
            <span className="hidden sm:inline">My Position</span>
            <span className="sm:hidden">Position</span>
            {you && (
              <span className={`rounded bg-carbon-black/40 px-1.5 py-0.5 ${NUMERIC}`}>
                P{you.rank}
              </span>
            )}
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile
          label="Tightest Battle"
          value={tightest ? tightest.gap : '—'}
          unit={tightest ? 'pts' : undefined}
          deltaLabel={tightest ? `P${tightest.ahead.rank} vs P${tightest.behind.rank}` : 'Needs two principals'}
          icon={F1CarIcon}
        />
        <StatTile
          label="Your Attack"
          value={you && youAhead ? pointsOf(youAhead) - pointsOf(you) : '—'}
          unit={you && youAhead ? 'pts' : undefined}
          deltaLabel={
            you
              ? youAhead
                ? `P${youAhead.rank} ${youAhead.displayName}`
                : 'Leading the championship'
              : 'Not in these standings'
          }
          icon={TrendingUpIcon}
        />
        <StatTile
          label="Your Cushion"
          value={you && youBehind ? pointsOf(you) - pointsOf(youBehind) : '—'}
          unit={you && youBehind ? 'pts' : undefined}
          deltaLabel={
            you
              ? youBehind
                ? `P${youBehind.rank} ${youBehind.displayName}`
                : 'Last on the road'
              : 'Not in these standings'
          }
          icon={LockIcon}
        />
        <StatTile
          label="Leader's Lead"
          value={leader && runnerUp ? pointsOf(leader) - pointsOf(runnerUp) : '—'}
          unit={leader && runnerUp ? 'pts' : undefined}
          deltaLabel={leader?.displayName}
          icon={TrophyIcon}
        />
      </div>

      <GapLadder users={users} currentUser={currentUser} onInspect={onSelectUser} />

      <Drawer
        isOpen={radarOpen && !!radarSubject}
        onClose={() => setRadarOpen(false)}
        title="Position Radar"
        subtitle="Where one principal sits, and the gaps that can move"
        width="xl"
      >
        {radarSubject && (
          <BattleRadar
            users={users}
            subject={radarSubject}
            isYou={isSameUser(radarSubject, currentUser)}
            onSelectSubject={setRadarSubject}
            onInspect={inspectFromRadar}
          />
        )}
      </Drawer>
    </div>
  );
};

export default ExecutiveDashboardView;
