import React, { useEffect, useRef } from 'react';
import { Tile, EmptyState, NUMERIC } from './ui/index.ts';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import { TrashIcon } from './icons/TrashIcon.tsx';
import type { PodiumEntry, P22AwardEntry } from '../services/seasonConfig.ts';

/** Podium inks, exactly as RaceChart (LeaderboardPage.tsx) colours P1–P3. */
const RANK_TEXT: Record<number, string> = { 1: 'text-yellow-400', 2: 'text-gray-300', 3: 'text-orange-400' };

/** Pedestal heights, in real podium order: P2 left, P1 centre and tallest, P3 right. */
const STEPS = [
  { place: 2, height: 'h-16 md:h-20' },
  { place: 1, height: 'h-24 md:h-28' },
  { place: 3, height: 'h-12 md:h-14' },
] as const;

/** One line per season, chosen by the label so it is stable all off-season and changes each year. */
const ROASTS = [
  'Backed the backmarker, weekend after weekend.',
  'Strategy call of the season: follow the car at the back.',
  'The pit wall is still running the numbers.',
  'Somebody had to keep the tail-enders company.',
  'A true connoisseur of the view from the back of the grid.',
  'Team radio, every Sunday: "We are checking."',
  'Proof that every car on the grid needs a fan.',
  'Box, box. No, stay out. Actually, box.',
  'The gravel trap\'s most loyal customer.',
  'Consistency is a skill. Just not this kind.',
  'Picked a lane: the slow one.',
  'When the lights went out, so did the hopes.',
] as const;
/** One burst per podium step, champion first; canvas colours, so raw hex is fine here. */
const BURSTS = [
  { place: 1, delay: 0,   particleCount: 140, spread: 100, colors: ['#FACC15', '#DA291C', '#FFFFFF'] },
  { place: 2, delay: 450, particleCount: 80,  spread: 80,  colors: ['#D1D5DB', '#FFFFFF'] },
  { place: 3, delay: 900, particleCount: 70,  spread: 75,  colors: ['#FB923C', '#FFFFFF'] },
] as const;

const roastFor = (label: string) => ROASTS[[...label].reduce((n, c) => n + c.charCodeAt(0), 0) % ROASTS.length];

interface ChampionHeroProps {
  label: string;
  finalPodium: PodiumEntry[];
  /** Fixed at conclusion; empty when nobody picked a last-place finisher. */
  p22Award: P22AwardEntry[];
  onViewStandings: () => void;
  /** Present once the season is archived, and so in the Hall of Fame. */
  onOpenHallOfFame?: () => void;
  /** True while the sign-in overlay covers the page: the confetti canvas sits above it. */
  holdConfetti?: boolean;
}

const ChampionHero: React.FC<ChampionHeroProps> = ({ label, finalPodium, p22Award, onViewStandings, onOpenHallOfFame, holdConfetti = false }) => {
  const champions = finalPodium.filter((p) => p.finalRank === 1);
  const stepRefs = useRef<Partial<Record<number, HTMLDivElement | null>>>({});
  // A stable key, so a fresh config snapshot mid-celebration cannot cancel the later bursts.
  const filledSteps = [1, 2, 3].filter((place) => finalPodium.some((p) => p.finalRank === place)).join(',');
  const year = label.match(/^\d{4}/)?.[0];

  // A celebration, not a notification: once per browser session per season, and never for
  // anyone who has asked for reduced motion.
  useEffect(() => {
    if (champions.length === 0 || holdConfetti) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const key = `lol_champion_confetti_${label}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* storage unavailable: celebrate anyway */ }
    const timers: number[] = [];
    import('canvas-confetti').then(({ default: confetti }) => {
      // Each burst comes from the top of its own pedestal. An empty step (no P3 in a two-member
      // league, P2 under a tie for first) gets no burst.
      for (const { place, delay, ...burst } of BURSTS) {
        if (!filledSteps.split(',').includes(String(place))) continue;
        timers.push(window.setTimeout(() => {
          const rect = stepRefs.current[place]?.getBoundingClientRect();
          const origin = rect
            ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: rect.top / window.innerHeight }
            : { x: 0.5, y: 0.4 };
          confetti({ ...burst, colors: [...burst.colors], origin, zIndex: 10000 });
        }, delay));
      }
    }).catch(() => { /* confetti is a nicety, not a requirement */ });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [label, champions.length, holdConfetti, filledSteps]);

  if (champions.length === 0) {
    return (
      <Tile padding="lg">
        <EmptyState icon={CheckeredFlagIcon} title="Season complete"
          description="No races remain on the calendar. See how the championship finished."
          action={
            <button onClick={onViewStandings}
              className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider bg-primary-red text-pure-white">
              View Standings
            </button>
          } />
      </Tile>
    );
  }

  return (
    <Tile glow padding="lg" className="relative overflow-hidden">
      <div className="absolute inset-0 bg-checkered-flag opacity-[0.03] pointer-events-none" aria-hidden="true" />
      <div className="relative flex flex-col items-center text-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-highlight-silver">{label} · Final</span>
        <TrophyIcon className="mt-3 h-10 w-10 text-yellow-400" aria-hidden="true" />
        <h2 className="mt-2 text-lg md:text-xl font-black uppercase italic tracking-wide text-pure-white">
          {champions.length > 1 ? 'Co-champions' : 'Champion'}
        </h2>

        <div className="mt-6 grid w-full max-w-lg grid-cols-[1fr_1.3fr_1fr] items-end gap-2 md:gap-3" role="list" aria-label="Final podium">
          {STEPS.map(({ place, height }) => {
            const holders = finalPodium.filter((p) => p.finalRank === place);
            return (
              <div key={place} role="listitem" className="flex min-w-0 flex-col items-center">
                <div className="mb-2 w-full space-y-0.5 px-1">
                  {holders.length === 0 ? (
                    <p className="text-sm font-bold text-highlight-silver" aria-label={`P${place} not awarded`}>—</p>
                  ) : holders.map((h) => (
                    <div key={h.uid}>
                      <p className={`break-words font-black uppercase italic leading-tight ${place === 1
                        ? 'text-lg md:text-2xl text-yellow-400' : 'text-xs md:text-sm text-pure-white'}`}>
                        {h.displayName}
                      </p>
                      <p className={`text-[11px] md:text-xs font-bold text-highlight-silver ${NUMERIC}`}>{h.totalPoints} pts</p>
                    </div>
                  ))}
                </div>
                <div ref={(el) => { stepRefs.current[place] = el; }}
                  className={`flex w-full ${height} items-start justify-center rounded-t-lg border border-b-0 bg-accent-gray/50 pt-2 ${place === 1 ? 'border-yellow-400/40' : 'border-pure-white/10'}`}>
                  <span className={`text-xl md:text-2xl font-black italic ${RANK_TEXT[place]} ${NUMERIC}`}>P{place}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="h-px w-full max-w-lg bg-pure-white/15" aria-hidden="true" />

        <P22AwardCard holders={p22Award} label={label} />

        {year && (
          <p className="mt-5 text-sm text-highlight-silver">The {Number(year) + 1} season is coming.</p>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={onViewStandings}
            className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider bg-primary-red text-pure-white">
            View final standings
          </button>
          {onOpenHallOfFame && (
            <button onClick={onOpenHallOfFame}
              className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider border border-pure-white/15 text-highlight-silver">
              Hall of Fame
            </button>
          )}
        </div>
      </div>
    </Tile>
  );
};

/** The P22 Award, a mock trophy for picking the last-place finisher most often. Parody, so no glow and no motion. */
const P22AwardCard: React.FC<{ holders: P22AwardEntry[]; label: string }> = ({ holders, label }) => (
  <div className="mt-6 w-full max-w-lg rounded-xl border border-dashed border-pure-white/20 bg-carbon-black/40 p-4 text-left">
    <div className="flex items-start gap-3">
      <div className="-rotate-12 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-pure-white/15 bg-accent-gray/60" aria-hidden="true">
        <TrashIcon className="h-5 w-5 text-highlight-silver" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-highlight-silver">The P22 Award · Wooden spoon</p>
        {holders.length === 0 ? (
          <p className="mt-1 text-sm font-bold text-pure-white">Unclaimed. Nobody backed the backmarker.</p>
        ) : (
          <>
            {holders.map((h) => (
              <p key={h.uid} className="mt-1 break-words text-lg md:text-xl font-black uppercase italic leading-tight text-pure-white">
                {h.displayName}
              </p>
            ))}
            <p className="mt-1 text-xs text-highlight-silver">
              {holders.length > 1 ? 'Each picked' : 'Picked'} the last-place finisher{' '}
              <span className={`font-bold text-ghost-white ${NUMERIC}`}>{holders[0].p22Count}</span>{' '}
              {holders[0].p22Count === 1 ? 'time' : 'times'}.
            </p>
            <p className="mt-2 text-sm italic text-ghost-white">“{roastFor(label)}”</p>
          </>
        )}
      </div>
    </div>
  </div>
);

export default ChampionHero;
