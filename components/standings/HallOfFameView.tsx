import React, { useCallback, useEffect, useState } from 'react';
import { Tile, EmptyState, NUMERIC } from '../ui/index.ts';
import { ListSkeleton } from '../LoadingSkeleton.tsx';
import { TrophyIcon } from '../icons/TrophyIcon.tsx';
import { BackIcon } from '../icons/BackIcon.tsx';
import { getSeasonArchives, getArchivedStandings, type SeasonArchiveSummary } from '../../services/firestoreService.ts';
import type { User } from '../../types.ts';

/** Podium inks, exactly as RaceChart (LeaderboardPage.tsx) colours P1–P3. */
const RANK_TEXT: Record<number, string> = { 1: 'text-yellow-400', 2: 'text-gray-300', 3: 'text-orange-400' };

interface HallOfFameViewProps {
  /** The season being viewed, from `?season=`; null shows the list. */
  seasonId: string | null;
  onSelectSeason: (seasonId: string | null) => void;
  /** Renders the leaderboard; LeaderboardPage passes its RaceChart, read-only. */
  renderLeaderboard: (users: User[]) => React.ReactNode;
}

const LoadError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <Tile padding="lg">
    <EmptyState icon={TrophyIcon} title="Couldn't load the Hall of Fame"
      description="Check your connection and try again."
      action={
        <button onClick={onRetry}
          className="rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider border border-pure-white/15 text-highlight-silver">
          Retry
        </button>
      } />
  </Tile>
);

const SeasonList: React.FC<{ onSelectSeason: (id: string) => void }> = ({ onSelectSeason }) => {
  const [seasons, setSeasons] = useState<SeasonArchiveSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setSeasons(null);
    getSeasonArchives().then(setSeasons).catch((error) => {
      console.error('[HallOfFame] season list', error);
      setFailed(true);
    });
  }, []);
  useEffect(load, [load]);

  if (failed) return <LoadError onRetry={load} />;
  if (!seasons) return <ListSkeleton rows={3} height="h-28" />;
  if (seasons.length === 0) {
    return (
      <Tile padding="lg">
        <EmptyState icon={TrophyIcon} title="No seasons archived yet"
          description="Each season joins the Hall of Fame once it is concluded and archived." />
      </Tile>
    );
  }

  return (
    <ul className="space-y-3">
      {seasons.map((s) => {
        const champions = s.finalPodium.filter((p) => p.finalRank === 1);
        const rest = s.finalPodium.filter((p) => p.finalRank > 1);
        return (
          <li key={s.seasonId}>
            <Tile padding="md" onClick={() => onSelectSeason(s.seasonId)}>
              <div className="flex items-start gap-4">
                <TrophyIcon className="mt-1 h-8 w-8 shrink-0 text-yellow-400" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg md:text-xl font-black uppercase italic tracking-wide text-pure-white">{s.label}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-highlight-silver">
                    {champions.length > 1 ? 'Co-champions' : 'Champion'}
                  </span>
                  <p className="font-black uppercase italic text-yellow-400 truncate">
                    {champions.map((c) => c.displayName).join(' & ') || '—'}
                    {champions[0] && <span className={`ml-2 text-sm font-bold not-italic text-ghost-white ${NUMERIC}`}>{champions[0].totalPoints}</span>}
                  </p>
                  {rest.length > 0 && (
                    <p className="mt-1 text-sm text-highlight-silver">
                      {rest.map((p, i) => (
                        <span key={p.uid}>
                          {i > 0 && ' · '}
                          <span className={`font-bold ${RANK_TEXT[p.finalRank] ?? ''} ${NUMERIC}`}>P{p.finalRank}</span>{' '}
                          {p.displayName}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            </Tile>
          </li>
        );
      })}
    </ul>
  );
};

const SeasonDetail: React.FC<{ seasonId: string; onBack: () => void; renderLeaderboard: HallOfFameViewProps['renderLeaderboard'] }> = ({
  seasonId, onBack, renderLeaderboard,
}) => {
  const [standings, setStandings] = useState<User[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setStandings(null);
    getArchivedStandings(seasonId).then(setStandings).catch((error) => {
      console.error('[HallOfFame] standings', error);
      setFailed(true);
    });
  }, [seasonId]);
  useEffect(load, [load]);

  return (
    <div>
      <button onClick={onBack}
        className="mb-3 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider border border-pure-white/15 text-highlight-silver">
        <BackIcon className="h-4 w-4" aria-hidden="true" />
        All seasons
      </button>
      <h3 className="text-lg md:text-xl font-black uppercase italic tracking-wide text-pure-white">{seasonId} Season · Final standings</h3>
      {failed && <div className="mt-3"><LoadError onRetry={load} /></div>}
      {!failed && !standings && <div className="mt-3"><ListSkeleton rows={6} height="h-10" /></div>}
      {standings && standings.length === 0 && (
        <Tile padding="lg" className="mt-3">
          <EmptyState icon={TrophyIcon} title="No standings in this archive" />
        </Tile>
      )}
      {standings && standings.length > 0 && renderLeaderboard(standings)}
    </div>
  );
};

const HallOfFameView: React.FC<HallOfFameViewProps> = ({ seasonId, onSelectSeason, renderLeaderboard }) => (
  <div className="py-2">
    {seasonId
      ? <SeasonDetail seasonId={seasonId} onBack={() => onSelectSeason(null)} renderLeaderboard={renderLeaderboard} />
      : <SeasonList onSelectSeason={onSelectSeason} />}
  </div>
);

export default HallOfFameView;
