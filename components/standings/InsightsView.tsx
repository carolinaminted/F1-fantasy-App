import React, { useEffect, useMemo, useState } from 'react';
import {
  Tile, StatTile, SectionHeader, SegmentedControl, Chip, EmptyState,
  CATEGORY_THEME, NUMERIC, type Category, type Segment,
} from '../ui/index.ts';
import { CheckeredFlagIcon } from '../icons/CheckeredFlagIcon.tsx';
import { PolePositionIcon } from '../icons/PolePositionIcon.tsx';
import { SprintIcon } from '../icons/SprintIcon.tsx';
import { FastestLapIcon } from '../icons/FastestLapIcon.tsx';
import { LightbulbIcon } from '../icons/LightbulbIcon.tsx';
import type { User } from '../../types.ts';

interface CategoryMeta {
  key: Category;
  label: string;
  leaderTitle: string;
  listTitle: string;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'gp',     label: 'Race',   leaderTitle: 'Race Day Dominator', listTitle: 'Sunday Specialists',  icon: CheckeredFlagIcon },
  { key: 'quali',  label: 'Quali',  leaderTitle: 'Qualifying King',    listTitle: 'Qualifying Masters',  icon: PolePositionIcon },
  { key: 'sprint', label: 'Sprint', leaderTitle: 'Sprint Specialist',  listTitle: 'Sprint Specialists',  icon: SprintIcon },
  { key: 'fl',     label: 'FL',     leaderTitle: 'Fastest Lap Hunter', listTitle: 'Fastest Lap Hunters', icon: FastestLapIcon },
];

const SEGMENTS: Segment<Category>[] = CATEGORIES.map(c => ({ value: c.key, label: c.label, icon: c.icon }));

interface InsightsViewProps {
  users: User[];
  currentUser: User | null;
  /** Category to open on, when arrived at from a category tile elsewhere in the app. */
  initialCategory?: Category;
}

/**
 * Where points come from, by scoring category.
 *
 * The four category leaders open the page as stat tiles, and — new here — so does the
 * reader's own profile across those categories. Insights previously only described other
 * people; the interesting question is which category *you* are strong in.
 */
export const InsightsView: React.FC<InsightsViewProps> = ({ users, currentUser, initialCategory }) => {
  const [active, setActive] = useState<Category>(initialCategory ?? 'gp');

  // Arriving from a different category tile re-points the view without a remount.
  useEffect(() => {
    if (initialCategory) setActive(initialCategory);
  }, [initialCategory]);

  const scoreOf = (u: User, key: Category) => u.breakdown?.[key] ?? 0;

  const leaders = useMemo(() => {
    const out = {} as Record<Category, { user: User; score: number } | null>;
    for (const { key } of CATEGORIES) {
      const valid = users.filter(u => typeof u.breakdown?.[key] === 'number');
      const sorted = [...valid].sort((a, b) => scoreOf(b, key) - scoreOf(a, key));
      out[key] = sorted[0] && scoreOf(sorted[0], key) > 0
        ? { user: sorted[0], score: scoreOf(sorted[0], key) }
        : null;
    }
    return out;
  }, [users]);

  const ranked = useMemo(
    () => [...users]
      .filter(u => typeof u.breakdown?.[active] === 'number')
      .sort((a, b) => scoreOf(b, active) - scoreOf(a, active))
      .slice(0, 10),
    [users, active]
  );

  const meta = CATEGORIES.find(c => c.key === active)!;
  const theme = CATEGORY_THEME[active];
  const categoryLeader = ranked[0];

  return (
    <div className="flex flex-col md:h-full gap-6 animate-fade-in pb-24 md:pb-safe pt-1 md:overflow-y-auto custom-scrollbar pr-1">
      <div>
        <SectionHeader
          title="Category Leaders"
          subtitle="Who earns most from each part of a race weekend"
          icon={LightbulbIcon}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {CATEGORIES.map(cat => {
            const data = leaders[cat.key];
            return (
              <StatTile
                key={cat.key}
                label={cat.leaderTitle}
                value={data ? data.score.toLocaleString() : '—'}
                unit={data ? 'pts' : undefined}
                deltaLabel={data?.user.displayName ?? 'No data yet'}
                accent={cat.key}
                icon={cat.icon}
              />
            );
          })}
        </div>
      </div>

      <div>
        {/* On a phone the four-segment switcher is nearly as wide as the screen, and keeping it
            inline squeezed the title down to one letter — so it gets its own row there. */}
        <SectionHeader
          title={meta.listTitle}
          subtitle="Rankings and point gaps for this category"
          icon={meta.icon}
          action={
            <div className="hidden md:block">
              <SegmentedControl segments={SEGMENTS} value={active} onChange={v => setActive(v)} size="sm" scrollable />
            </div>
          }
        />
        <div className="md:hidden mb-3">
          <SegmentedControl segments={SEGMENTS} value={active} onChange={v => setActive(v)} size="sm" scrollable />
        </div>

        {ranked.length > 0 ? (
          <Tile padding="sm">
            {ranked.map((user, i) => {
              const score = scoreOf(user, active);
              const gap = categoryLeader ? score - scoreOf(categoryLeader, active) : 0;
              const isYou = user.id === currentUser?.id;
              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 px-2 py-2.5 rounded-lg ${i > 0 ? 'mt-0.5' : ''} ${
                    isYou ? 'bg-pure-white/[0.07] ring-1 ring-inset ring-pure-white/25' : ''
                  }`}
                >
                  <span className={`w-7 text-center font-black ${NUMERIC} ${i === 0 ? theme.text : 'text-highlight-silver'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-pure-white truncate">{user.displayName}</span>
                      {isYou && <Chip label="You" tone="neutral" size="xs" />}
                    </div>
                    <span className="text-[10px] text-highlight-silver/70">
                      {(user.totalPoints ?? 0).toLocaleString()} total pts
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`block font-bold ${NUMERIC} ${theme.text}`}>{score.toLocaleString()}</span>
                    {i > 0 && (
                      <span className={`text-[10px] ${NUMERIC} text-primary-red/80`}>{gap} pts</span>
                    )}
                    {i === 0 && (
                      <span className="text-[10px] uppercase tracking-wider text-highlight-silver/70">Leader</span>
                    )}
                  </div>
                </div>
              );
            })}
          </Tile>
        ) : (
          <Tile padding="none">
            <EmptyState icon={meta.icon} title="No data yet"
              description="This category has not been scored for anyone this season." />
          </Tile>
        )}
      </div>
    </div>
  );
};
