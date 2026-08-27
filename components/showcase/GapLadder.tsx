import React, { useEffect, useMemo, useState } from 'react';
import { Tile, Chip, EmptyState, CATEGORY_THEME, NUMERIC } from '../ui/index.ts';
import { EyeIcon } from '../icons/EyeIcon.tsx';
import { ChevronDownIcon } from '../icons/ChevronDownIcon.tsx';
import { TrophyIcon } from '../icons/TrophyIcon.tsx';
import { CheckeredFlagIcon } from '../icons/CheckeredFlagIcon.tsx';
import { CategoryBar } from './CategoryBreakdown.tsx';
import { CATEGORY_KEYS, categoryOf, pointsOf, isSameUser, type ProcessedUser } from './utils.ts';
import type { User } from '../../types.ts';

/**
 * The Battle Board — the whole field as one ladder, where the space *between* two rows
 * carries the number that matters: the interval.
 *
 * An F1 timing screen doesn't rank drivers so much as it ranks gaps, and that is the model
 * here. Every adjacent pair gets a connector chip with the interval; the tightest quartile
 * of the field's gaps render hot as live battles. Tapping any principal breaks their two
 * gaps down by scoring category — where the points to attack the car ahead actually are,
 * and which category the car behind is closing in.
 */

type Heat = 'battle' | 'close' | 'clear';

interface GapLadderProps {
  users: ProcessedUser[];
  currentUser: User | null;
  onInspect: (user: ProcessedUser) => void;
}

/* ---------------------------------------------------------------- connector */

const GapConnector: React.FC<{ gap: number; places: number; heat: Heat }> = ({
  gap, places, heat,
}) => {
  const chip =
    heat === 'battle'
      ? 'text-primary-red border-primary-red/50 bg-primary-red/10'
      : heat === 'close'
      ? 'text-pure-white border-pure-white/25 bg-pure-white/5'
      : 'text-highlight-silver border-pure-white/10';

  return (
    <div className="flex items-center gap-2 pl-3 py-0.5" aria-hidden="true">
      <div className="w-8 flex justify-center shrink-0">
        <div className={`h-4 w-px ${heat === 'battle' ? 'bg-primary-red/60' : 'bg-pure-white/15'}`} />
      </div>
      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${NUMERIC} ${chip}`}>
        {heat === 'battle' && <span className="w-1.5 h-1.5 rounded-full bg-primary-red animate-pulse" />}
        {gap === 0 ? 'Level on points' : `+${gap} pts`}
        {places > 1 && <span className="opacity-60">· {places} places</span>}
        {heat === 'battle' && gap !== 0 && <span>· battle</span>}
      </span>
    </div>
  );
};

/* ------------------------------------------------------------ battle panels */

const signed = (delta: number) =>
  delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : '±0';

const deltaTone = (delta: number) =>
  delta > 0 ? 'text-green-400' : delta < 0 ? 'text-primary-red' : 'text-highlight-silver';

const BattlePanel: React.FC<{
  mode: 'attack' | 'defense';
  self: ProcessedUser;
  neighbor: ProcessedUser;
  onInspect: (u: ProcessedUser) => void;
}> = ({ mode, self, neighbor, onInspect }) => {
  const attack = mode === 'attack';
  const total = attack
    ? pointsOf(neighbor) - pointsOf(self)
    : pointsOf(self) - pointsOf(neighbor);

  const deltas = CATEGORY_KEYS.map(k => ({ key: k, delta: categoryOf(self, k) - categoryOf(neighbor, k) }));
  // Both readings care about the same row: the category where you have the least in hand.
  const focus = deltas.reduce((a, b) => (b.delta < a.delta ? b : a));
  const focusTheme = CATEGORY_THEME[focus.key];

  const note = attack
    ? focus.delta < 0
      ? <>Biggest deficit: <strong className={focusTheme.text}>{focusTheme.label}</strong> ({signed(focus.delta)}) — that is where the gap lives.</>
      : <>No category deficit — the gap sits outside the four categories.</>
    : focus.delta < 0
      ? <>They already outscore you in <strong className={focusTheme.text}>{focusTheme.label}</strong> ({signed(focus.delta)}).</>
      : <>Thinnest cover: <strong className={focusTheme.text}>{focusTheme.label}</strong> ({signed(focus.delta)}).</>;

  return (
    <div className="rounded-lg border border-pure-white/10 bg-carbon-black/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-black uppercase tracking-widest ${attack ? 'text-primary-red' : 'text-green-400'}`}>
          {attack ? 'Attack' : 'Defend'}
        </span>
        <button
          onClick={() => onInspect(neighbor)}
          className="flex items-center gap-1 rounded-md border border-pure-white/10 bg-pure-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-highlight-silver transition-colors hover:bg-pure-white/10 hover:text-pure-white"
        >
          <EyeIcon className="w-2.5 h-2.5" />
          <span>Inspect</span>
        </button>
      </div>

      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-bold text-pure-white">
          P{neighbor.rank} {neighbor.displayName}
        </span>
        <span className={`shrink-0 text-lg font-black leading-none ${NUMERIC} ${
          total === 0 ? 'text-highlight-silver' : attack ? 'text-primary-red' : 'text-green-400'
        }`}>
          {total === 0 ? 'Level' : `${attack ? '−' : '+'}${total}`}
          {total !== 0 && <span className="ml-1 text-[10px] font-bold uppercase text-highlight-silver">pts</span>}
        </span>
      </div>

      <div className="mt-2.5 space-y-1">
        {deltas.map(({ key, delta }) => {
          const t = CATEGORY_THEME[key];
          return (
            <div key={key} className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 text-[11px]">
              <span className={`font-bold uppercase tracking-wider ${t.text}`}>{t.label}</span>
              <span className={`${NUMERIC} text-highlight-silver`}>
                <span className="text-pure-white font-bold">{categoryOf(self, key)}</span>
                <span className="opacity-70"> vs {categoryOf(neighbor, key)}</span>
              </span>
              <span className={`w-9 text-right font-black ${NUMERIC} ${deltaTone(delta)}`}>
                {signed(delta)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="mt-2.5 border-t border-pure-white/10 pt-2 text-[11px] leading-snug text-highlight-silver">
        {note}
      </p>
    </div>
  );
};

const ClearTrack: React.FC<{ front: boolean }> = ({ front }) => (
  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-pure-white/15 p-4 text-center">
    {front
      ? <TrophyIcon className="mb-1.5 w-5 h-5 text-amber-400" />
      : <CheckeredFlagIcon className="mb-1.5 w-5 h-5 text-highlight-silver" />}
    <span className="text-xs font-bold text-pure-white">
      {front ? 'Clear track ahead' : 'No one behind'}
    </span>
    <span className="mt-0.5 text-[10px] uppercase tracking-wider text-highlight-silver">
      {front ? 'Championship leader' : 'Last on the road'}
    </span>
  </div>
);

/* ------------------------------------------------------------------- ladder */

export const GapLadder: React.FC<GapLadderProps> = ({ users, currentUser, onInspect }) => {
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoExpanded, setAutoExpanded] = useState(false);

  const you = useMemo(() => users.find(u => isSameUser(u, currentUser)) ?? null, [users, currentUser]);

  // Your own battle is the first thing you came to see; open it once the data lands.
  useEffect(() => {
    if (!autoExpanded && you) {
      setExpandedId(you.id);
      setAutoExpanded(true);
    }
  }, [you, autoExpanded]);

  // Heat is relative to this field, not to a magic number: the tightest quartile of the
  // league's own intervals reads as a battle, the next as close, the rest as clear air.
  const heatOf = useMemo(() => {
    const gaps: number[] = [];
    for (let i = 1; i < users.length; i++) gaps.push(pointsOf(users[i - 1]) - pointsOf(users[i]));
    const sorted = [...gaps].sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))] ?? 0;
    const battle = q(0.25);
    const close = q(0.55);
    return (gap: number): Heat =>
      sorted.length === 0 ? 'clear' : gap <= battle ? 'battle' : gap <= close ? 'close' : 'clear';
  }, [users]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.displayName?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q) ||
      String(u.rank ?? '').includes(q)
    );
  }, [users, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search principal or rank…"
            value={search}
            onChange={e => setSearch(e.target.value)}
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
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-highlight-silver shrink-0">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-red" /> Battle</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-pure-white/70" /> Close</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-pure-white/20" /> Clear air</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <Tile padding="none">
          <EmptyState
            icon={CheckeredFlagIcon}
            title="No principals match"
            description="Try a different name or rank."
          />
        </Tile>
      ) : (
        <div>
          {rows.map((user, i) => {
            const prev = i > 0 ? rows[i - 1] : null;
            const gap = prev ? pointsOf(prev) - pointsOf(user) : 0;
            const places = prev ? Math.max(1, (user.rank ?? 0) - (prev.rank ?? 0)) : 1;
            // Heat only means something for true neighbours; a filtered jump is just distance.
            const heat: Heat = prev && places === 1 ? heatOf(gap) : 'clear';

            const isYou = isSameUser(user, currentUser);
            const isLeader = user.rank === 1;
            const expanded = expandedId === user.id;

            return (
              <React.Fragment key={user.id}>
                {prev && <GapConnector gap={gap} places={places} heat={heat} />}
                <Tile
                  padding="sm"
                  onClick={() => setExpandedId(expanded ? null : user.id)}
                  className={[
                    isLeader ? 'border-amber-400/50 bg-gradient-to-r from-amber-400/[0.06] to-transparent' : '',
                    isYou ? 'ring-1 ring-inset ring-pure-white/25 bg-pure-white/[0.06]' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${NUMERIC} shrink-0 ${
                        isLeader
                          ? 'bg-amber-400 text-carbon-black'
                          : 'bg-carbon-black border border-pure-white/15 text-highlight-silver'
                      }`}>
                        {user.rank}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-pure-white truncate">{user.displayName}</span>
                          {isYou && <Chip label="You" tone="neutral" size="xs" />}
                        </div>
                        <span className={`text-[11px] text-highlight-silver ${NUMERIC}`}>
                          {pointsOf(user).toLocaleString()} pts
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={e => { e.stopPropagation(); onInspect(user); }}
                        aria-label={`Inspect ${user.displayName}`}
                        className="p-2 rounded-lg bg-pure-white/5 border border-pure-white/10 text-highlight-silver hover:bg-primary-red hover:border-primary-red hover:text-pure-white transition-colors"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <ChevronDownIcon
                        className={`w-4 h-4 text-highlight-silver transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                  </div>

                  <CategoryBar user={user} className="mt-2.5" />

                  {expanded && (() => {
                    // Neighbours come from the full field, so a filtered ladder still
                    // breaks down the real battle, not the battle with the search results.
                    const fullIndex = users.findIndex(u => u.id === user.id);
                    const ahead = fullIndex > 0 ? users[fullIndex - 1] : null;
                    const behind = fullIndex >= 0 && fullIndex < users.length - 1 ? users[fullIndex + 1] : null;
                    return (
                      <div
                        onClick={e => e.stopPropagation()}
                        className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-pure-white/10 pt-3 animate-fade-in cursor-default"
                      >
                        {ahead
                          ? <BattlePanel mode="attack" self={user} neighbor={ahead} onInspect={onInspect} />
                          : <ClearTrack front />}
                        {behind
                          ? <BattlePanel mode="defense" self={user} neighbor={behind} onInspect={onInspect} />
                          : <ClearTrack front={false} />}
                      </div>
                    );
                  })()}
                </Tile>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};
