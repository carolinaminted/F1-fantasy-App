import React, { useEffect } from 'react';
import { Tile, EmptyState, NUMERIC } from './ui/index.ts';
import { TrophyIcon } from './icons/TrophyIcon.tsx';
import { CheckeredFlagIcon } from './icons/CheckeredFlagIcon.tsx';
import type { PodiumEntry } from '../services/seasonConfig.ts';

/** Podium inks, exactly as RaceChart (LeaderboardPage.tsx) colours P1–P3. */
const RANK_TEXT: Record<number, string> = { 1: 'text-yellow-400', 2: 'text-gray-300', 3: 'text-orange-400' };

interface ChampionHeroProps {
  label: string;
  finalPodium: PodiumEntry[];
  onViewStandings: () => void;
}

const ChampionHero: React.FC<ChampionHeroProps> = ({ label, finalPodium, onViewStandings }) => {
  const champions = finalPodium.filter((p) => p.finalRank === 1);
  const rest = finalPodium.filter((p) => p.finalRank > 1);
  const year = label.match(/^\d{4}/)?.[0];

  // A celebration, not a notification: once per browser session per season, and never for
  // anyone who has asked for reduced motion.
  useEffect(() => {
    if (champions.length === 0) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const key = `lol_champion_confetti_${label}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* storage unavailable: celebrate anyway */ }
    import('canvas-confetti').then(({ default: confetti }) => {
      confetti({ particleCount: 140, spread: 100, origin: { y: 0.4 },
                 colors: ['#DA291C', '#FFFFFF', '#C0C0C0'], zIndex: 10000 });
    }).catch(() => { /* confetti is a nicety, not a requirement */ });
  }, [label, champions.length]);

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
        <div className="mt-2 space-y-1">
          {champions.map((c) => (
            <p key={c.uid} className="text-3xl md:text-4xl font-black uppercase italic tracking-wider text-yellow-400">
              {c.displayName}
            </p>
          ))}
        </div>
        <p className={`mt-1 text-sm font-bold text-ghost-white ${NUMERIC}`}>{champions[0].totalPoints} pts</p>

        {rest.length > 0 && (
          <ol className="mt-5 w-full max-w-xs space-y-1.5">
            {rest.map((p) => (
              <li key={p.uid} className="flex items-center justify-between gap-3 text-sm">
                <span className={`font-black italic ${RANK_TEXT[p.finalRank] ?? 'text-highlight-silver'} ${NUMERIC}`}>P{p.finalRank}</span>
                <span className="flex-1 truncate text-left font-bold text-pure-white">{p.displayName}</span>
                <span className={`text-highlight-silver ${NUMERIC}`}>{p.totalPoints}</span>
              </li>
            ))}
          </ol>
        )}

        {year && (
          <p className="mt-5 text-sm text-highlight-silver">The {Number(year) + 1} season is coming.</p>
        )}
        <button onClick={onViewStandings}
          className="mt-4 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider bg-primary-red text-pure-white">
          View final standings
        </button>
      </div>
    </Tile>
  );
};

export default ChampionHero;
