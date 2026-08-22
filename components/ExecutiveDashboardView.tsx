import React, { useMemo, useState } from 'react';
import {
  Tile, StatTile, SectionHeader, SegmentedControl, Drawer, EmptyState,
  NUMERIC, type Segment,
} from './ui/index.ts';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { F1CarIcon } from './icons/F1CarIcon.tsx';
import { ProfileIcon } from './icons/ProfileIcon.tsx';
import { LeaderboardIcon } from './icons/LeaderboardIcon.tsx';
import { ChampionCard, PodiumCard } from './showcase/PodiumCards.tsx';
import { ContenderCard } from './showcase/ContenderCard.tsx';
import { PackRow } from './showcase/PackRow.tsx';
import { BattleRadar } from './showcase/BattleRadar.tsx';
import { isSameUser, pointsOf, type ProcessedUser } from './showcase/utils.ts';
import type { User } from '../types.ts';

interface ExecutiveDashboardViewProps {
  users: ProcessedUser[];
  currentUser: User | null;
  onSelectUser: (user: ProcessedUser) => void;
}

type TabMode = 'top10' | 'rest';
type TierFilter = 'all' | 'chasers' | 'midfield' | 'backmarkers';

const TABS: Segment<TabMode>[] = [
  { value: 'top10', label: 'Top 10', icon: TrophyIcon },
  { value: 'rest', label: 'Rest of Pack', icon: CheckeredFlagIcon },
];

const TIERS: Segment<TierFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'chasers', label: 'P11–P20' },
  { value: 'midfield', label: 'P21–P30' },
  { value: 'backmarkers', label: 'P31+' },
];

const PAGE_SIZE = 15;

/**
 * The Showcase — the championship read as a race classification.
 *
 * Rebuilt in Gate 10 on the shared kit. What used to be a 2,112-line component with its own
 * gold-and-amber palette is now this shell plus five pieces in `components/showcase/`.
 * Gold survives in exactly one place: the champion. Everything the page reports is derived
 * from the standings it is already given — see BattleRadar and PerformanceRadar for the
 * simulated figures that were removed rather than restyled.
 */
export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  users, currentUser, onSelectUser,
}) => {
  const [tab, setTab] = useState<TabMode>('top10');
  const [tier, setTier] = useState<TierFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [radarSubject, setRadarSubject] = useState<ProcessedUser | null>(null);
  const [radarOpen, setRadarOpen] = useState(false);

  const top10 = useMemo(() => users.slice(0, 10), [users]);
  const pack = useMemo(() => users.slice(10), [users]);

  const leader = users[0] ?? null;
  const leaderPoints = pointsOf(leader);
  const cutoff = users[9] ?? null;
  const cutoffPoints = pointsOf(cutoff);

  const you = useMemo(
    () => users.find(u => isSameUser(u, currentUser)) ?? null,
    [users, currentUser]
  );

  const filteredPack = useMemo(() => {
    let result = pack;

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(u =>
        u.displayName?.toLowerCase().includes(q) ||
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        String(u.rank ?? '').includes(q)
      );
    }

    if (tier !== 'all') {
      result = result.filter(u => {
        const r = u.rank ?? 0;
        if (tier === 'chasers') return r >= 11 && r <= 20;
        if (tier === 'midfield') return r >= 21 && r <= 30;
        return r >= 31;
      });
    }

    return result;
  }, [pack, search, tier]);

  const totalPages = Math.max(1, Math.ceil(filteredPack.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filteredPack.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredPack, safePage]
  );

  const openRadar = (user: ProcessedUser | null) => {
    setRadarSubject(user ?? you ?? users[0] ?? null);
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
        title="Championship Showcase"
        subtitle="The season, read as a race classification"
        icon={TrophyIcon}
        action={
          <button
            onClick={() => openRadar(null)}
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
        <StatTile label="Principals" value={users.length} unit="active" icon={ProfileIcon} />
        <StatTile
          label="Championship Leader"
          value={leaderPoints.toLocaleString()}
          unit="pts"
          deltaLabel={leader?.displayName}
          icon={TrophyIcon}
        />
        <StatTile
          label="Top 10 Cutoff"
          value={cutoffPoints.toLocaleString()}
          unit="pts"
          deltaLabel={cutoff ? `P10 ${cutoff.displayName}` : 'Not set'}
          icon={CheckeredFlagIcon}
        />
        <StatTile
          label="Your Position"
          value={you ? `P${you.rank}` : '—'}
          deltaLabel={
            you
              ? you.rank === 1
                ? 'Leading the championship'
                : `−${leaderPoints - pointsOf(you)} to P1`
              : 'Not in these standings'
          }
          icon={LeaderboardIcon}
        />
      </div>

      <div className="mb-5">
        <SegmentedControl segments={TABS} value={tab} onChange={v => setTab(v)} />
      </div>

      {tab === 'top10' ? (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {top10[1] && (
              <PodiumCard
                user={top10[1]} position={2} leaderPoints={leaderPoints}
                isYou={isSameUser(top10[1], currentUser)} onInspect={onSelectUser}
              />
            )}
            {top10[0] && (
              <ChampionCard
                user={top10[0]} leaderPoints={leaderPoints}
                runnerUpPoints={pointsOf(top10[1])}
                isYou={isSameUser(top10[0], currentUser)} onInspect={onSelectUser}
              />
            )}
            {top10[2] && (
              <PodiumCard
                user={top10[2]} position={3} leaderPoints={leaderPoints}
                isYou={isSameUser(top10[2], currentUser)} onInspect={onSelectUser}
              />
            )}
          </div>

          {top10.length > 3 && (
            <div>
              <SectionHeader
                title="Contender Grid"
                subtitle="P4 – P10, and the gap to the car in front"
                icon={F1CarIcon}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {top10.slice(3).map((user, idx) => (
                  <ContenderCard
                    key={user.id}
                    user={user}
                    rank={idx + 4}
                    leaderPoints={leaderPoints}
                    aheadPoints={pointsOf(top10[idx + 2])}
                    isYou={isSameUser(user, currentUser)}
                    isCutoff={idx + 4 === 10}
                    onInspect={onSelectUser}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          <SectionHeader
            title="The Pack"
            subtitle={`P11 down · ${(cutoffPoints + 1).toLocaleString()} pts buys a top-10 seat`}
            icon={CheckeredFlagIcon}
          />

          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search principal or rank…"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="w-full rounded-xl border border-pure-white/10 bg-carbon-black px-3.5 py-2.5 text-sm text-pure-white placeholder-highlight-silver/50 transition-colors focus:border-primary-red focus:outline-none"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase tracking-wider text-highlight-silver hover:text-pure-white"
                >
                  Clear
                </button>
              )}
            </div>
            <SegmentedControl
              segments={TIERS} value={tier} size="sm" scrollable
              onChange={v => { setTier(v); setPage(1); }}
            />
          </div>

          <div className={`flex items-center justify-between text-[11px] uppercase tracking-wider text-highlight-silver ${NUMERIC}`}>
            <span>Showing {pageRows.length} of {filteredPack.length}</span>
            <span>Page {safePage} of {totalPages}</span>
          </div>

          {pageRows.length > 0 ? (
            <div className="space-y-2">
              {pageRows.map(user => (
                <PackRow
                  key={user.id}
                  user={user}
                  leaderPoints={leaderPoints}
                  cutoffPoints={cutoffPoints}
                  isYou={isSameUser(user, currentUser)}
                  onInspect={onSelectUser}
                />
              ))}
            </div>
          ) : (
            <Tile padding="none">
              <EmptyState
                icon={CheckeredFlagIcon}
                title="No principals match"
                description="Try a different search term or tier."
              />
            </Tile>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="rounded-lg border border-pure-white/10 bg-carbon-black px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-pure-white/10 disabled:opacity-40"
              >
                ← Prev
              </button>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[55%]">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 shrink-0 rounded-lg text-[11px] font-bold transition-colors ${NUMERIC} ${
                      safePage === p
                        ? 'bg-primary-red text-pure-white'
                        : 'bg-carbon-black text-highlight-silver hover:bg-pure-white/10'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="rounded-lg border border-pure-white/10 bg-carbon-black px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-pure-white transition-colors hover:bg-pure-white/10 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

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
