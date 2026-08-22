import React from 'react';
import { Tile, StatTile, SectionHeader, Chip, CATEGORY_THEME, NUMERIC } from '../ui/index.ts';
import { TrophyIcon } from '../icons/TrophyIcon.tsx';
import { TrendingUpIcon } from '../icons/TrendingUpIcon.tsx';
import { EyeIcon } from '../icons/EyeIcon.tsx';
import { F1CarIcon } from '../icons/F1CarIcon.tsx';
import { CategoryStrip } from './CategoryBreakdown.tsx';
import { PerformanceRadar } from './PerformanceRadar.tsx';
import {
  categoryDeltas, leagueAverages, pointsOf, type ProcessedUser,
} from './utils.ts';

interface BattleRadarProps {
  users: ProcessedUser[];
  subject: ProcessedUser;
  isYou: boolean;
  onSelectSubject: (user: ProcessedUser) => void;
  onInspect: (user: ProcessedUser) => void;
}

const RivalCard: React.FC<{
  user: ProcessedUser;
  gapLabel: string;
  gap: number;
  onInspect: (u: ProcessedUser) => void;
}> = ({ user, gapLabel, gap, onInspect }) => (
  <Tile padding="sm">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-7 h-7 rounded-lg bg-carbon-black border border-pure-white/15 text-highlight-silver flex items-center justify-center text-xs font-black ${NUMERIC} shrink-0`}>
          {user.rank}
        </span>
        <div className="min-w-0">
          <span className="block text-sm font-bold text-pure-white truncate">{user.displayName}</span>
          <span className={`text-[11px] text-highlight-silver ${NUMERIC}`}>
            {pointsOf(user).toLocaleString()} pts
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className={`block text-base font-black text-pure-white ${NUMERIC}`}>
          {gap >= 0 ? '+' : '−'}{Math.abs(gap)}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-highlight-silver">
          {gapLabel}
        </span>
      </div>
    </div>
    <CategoryStrip user={user} className="mt-2.5" />
    <button
      onClick={() => onInspect(user)}
      className="mt-2 w-full py-1.5 rounded-lg bg-pure-white/5 border border-pure-white/10 text-highlight-silver hover:bg-primary-red hover:border-primary-red hover:text-pure-white text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
    >
      <EyeIcon className="w-3 h-3" />
      <span>Inspect</span>
    </button>
  </Tile>
);

/**
 * One principal's position in the championship, and the two gaps that can actually change.
 *
 * Everything here is derived from the standings already on the page. The version this
 * replaces also reported "ERS 88%", "DRS: ACTIVE", an "Overtake Potential" percentage and
 * a "Defensive Rating" percentage — the last two computed from formulas with no meaning in
 * the league's rules. Real gaps say the same thing without inventing a scale.
 */
export const BattleRadar: React.FC<BattleRadarProps> = ({
  users, subject, isYou, onSelectSubject, onInspect,
}) => {
  const index = users.findIndex(u => u.id === subject.id);
  const leader = users[0] ?? null;
  const ahead = index > 0 ? users[index - 1] : null;
  const behind = index >= 0 && index < users.length - 1 ? users[index + 1] : null;
  const chasers = index > 1 ? users.slice(Math.max(0, index - 2), index) : ahead ? [ahead] : [];
  const pursuers = index >= 0 ? users.slice(index + 1, index + 3) : [];

  const points = pointsOf(subject);
  const averages = leagueAverages(users);
  const deltas = categoryDeltas(subject, averages);
  const best = [...deltas].sort((a, b) => b.delta - a.delta)[0];
  const worst = [...deltas].sort((a, b) => a.delta - b.delta)[0];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-highlight-silver mb-1.5">
          Focus on
        </label>
        <select
          value={subject.id}
          onChange={e => {
            const next = users.find(u => u.id === e.target.value);
            if (next) onSelectSubject(next);
          }}
          className="w-full bg-carbon-black border border-pure-white/10 rounded-xl px-3 py-2.5 text-sm font-bold text-pure-white focus:outline-none focus:border-primary-red transition-colors"
        >
          {users.map(u => (
            <option key={u.id} value={u.id} className="bg-carbon-black text-pure-white">
              P{u.rank} — {u.displayName} ({pointsOf(u).toLocaleString()} pts)
            </option>
          ))}
        </select>
      </div>

      <Tile padding="md" className={isYou ? 'ring-1 ring-inset ring-pure-white/25' : ''}>
        <div className="flex items-center gap-3">
          <span className={`w-12 h-12 rounded-xl bg-primary-red text-pure-white flex items-center justify-center text-lg font-black ${NUMERIC} shrink-0`}>
            {subject.rank}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black text-pure-white truncate">{subject.displayName}</h3>
              {isYou && <Chip label="You" tone="neutral" size="xs" />}
            </div>
            <span className={`text-sm text-highlight-silver ${NUMERIC}`}>
              {points.toLocaleString()} pts
              {leader && subject.id !== leader.id && ` · −${pointsOf(leader) - points} to P1`}
            </span>
          </div>
        </div>
      </Tile>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          label="To Overtake"
          value={ahead ? pointsOf(ahead) - points : '—'}
          unit={ahead ? 'pts' : undefined}
          deltaLabel={ahead ? `P${ahead.rank} ${ahead.displayName}` : 'Leading the championship'}
          icon={TrendingUpIcon}
        />
        <StatTile
          label="Cushion Behind"
          value={behind ? points - pointsOf(behind) : '—'}
          unit={behind ? 'pts' : undefined}
          deltaLabel={behind ? `P${behind.rank} ${behind.displayName}` : 'Last on the road'}
          icon={F1CarIcon}
        />
      </div>

      <div>
        <SectionHeader
          title="Category Shape"
          subtitle={leader ? `Overlaid on P1 ${leader.displayName}` : 'Across the four scoring categories'}
          icon={TrophyIcon}
        />
        <Tile padding="md">
          <PerformanceRadar user={subject} leader={leader} isYou={isYou} />
        </Tile>
      </div>

      <div>
        <SectionHeader
          title="Against the Field"
          subtitle="Category totals compared with the league average"
          icon={TrendingUpIcon}
        />
        <Tile padding="md">
          <div className="space-y-3">
            {deltas.map(({ key, value, delta }) => {
              const theme = CATEGORY_THEME[key];
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className={`w-24 shrink-0 text-[11px] font-bold uppercase tracking-wider ${theme.text}`}>
                    {theme.label}
                  </span>
                  <span className={`w-12 text-right text-sm font-black text-pure-white ${NUMERIC}`}>
                    {value}
                  </span>
                  <span className={`flex-1 text-[11px] text-highlight-silver ${NUMERIC}`}>
                    league avg {averages[key]}
                  </span>
                  <span
                    className={`text-sm font-black shrink-0 ${NUMERIC} ${
                      delta > 0 ? 'text-green-400' : delta < 0 ? 'text-primary-red' : 'text-highlight-silver'
                    }`}
                  >
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="mt-4 pt-3 border-t border-pure-white/10 text-xs text-highlight-silver leading-relaxed">
            Strongest against the field in{' '}
            <strong className={CATEGORY_THEME[best.key].text}>{CATEGORY_THEME[best.key].label}</strong>
            {best.delta > 0 ? ` (+${best.delta} on the average)` : ''}. Most ground to make up in{' '}
            <strong className={CATEGORY_THEME[worst.key].text}>{CATEGORY_THEME[worst.key].label}</strong>
            {worst.delta < 0 ? ` (${worst.delta} on the average)` : ''}.
          </p>
        </Tile>
      </div>

      {chasers.length > 0 && (
        <div>
          <SectionHeader title="Ahead" subtitle="Positions within reach" icon={TrendingUpIcon} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {chasers.map(u => (
              <RivalCard
                key={u.id}
                user={u}
                gap={pointsOf(u) - points}
                gapLabel="to catch"
                onInspect={onInspect}
              />
            ))}
          </div>
        </div>
      )}

      {pursuers.length > 0 && (
        <div>
          <SectionHeader title="Behind" subtitle="Who is closing in" icon={F1CarIcon} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pursuers.map(u => (
              <RivalCard
                key={u.id}
                user={u}
                gap={points - pointsOf(u)}
                gapLabel="cushion"
                onInspect={onInspect}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
