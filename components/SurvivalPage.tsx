import React, { useMemo } from 'react';
import { PageHeader, EmptyState, Banner, Chip } from './ui/index.ts';
import { SurvivalIcon } from './icons/SurvivalIcon.tsx';
import { SurvivalRoundCard } from './survival/SurvivalRoundCard.tsx';
import { SurvivalBoard } from './survival/SurvivalBoard.tsx';
import { useSurvival } from '../hooks/useSurvival.ts';
import { currentSurvivalRound, survivalRounds } from '../utils/survival.ts';
import type { Constructor, Driver, Event, RaceResults, User } from '../types.ts';

interface SurvivalPageProps {
  user: User | null;
  events: Event[];
  allDrivers: Driver[];
  allConstructors: Constructor[];
  cancelledEventIds: Set<string>;
  formLocks: { [eventId: string]: boolean };
  raceResults: RaceResults;
}

/**
 * Podium Survival Challenge: one driver per Grand Prix, podium or out. Standings and pick
 * validation are server-side (functions/survival.js); this page only reads and submits.
 */
const SurvivalPage: React.FC<SurvivalPageProps> = ({
  user, events, allDrivers, allConstructors, cancelledEventIds, formLocks, raceResults,
}) => {
  const { config, standings, picks, names, loading } = useSurvival();

  const rounds = useMemo(() => survivalRounds(events, config, cancelledEventIds), [events, config, cancelledEventIds]);
  const round = useMemo(() => currentSurvivalRound(rounds, raceResults), [rounds, raceResults]);
  const eventName = (id: string | null) => events.find(e => e.id === id)?.name ?? 'Unknown round';

  const header = (
    <PageHeader
      title="PODIUM SURVIVAL"
      icon={SurvivalIcon}
      subtitle={config?.prize ? `Prize: ${config.prize}` : undefined}
      rightAction={config?.status === 'active' && standings?.status !== 'complete'
        ? <Chip label={`Round ${Math.max(1, rounds.findIndex(r => r.id === round?.id) + 1)} of ${rounds.length}`} tone="neutral" size="sm" />
        : undefined}
    />
  );

  if (loading || !user) return <div className="w-full max-w-5xl mx-auto px-2 md:px-0">{header}</div>;

  if (!config || config.status !== 'active') {
    return (
      <div className="w-full max-w-5xl mx-auto px-2 md:px-0 pb-24 md:pb-12">
        {header}
        <EmptyState
          icon={SurvivalIcon}
          title="No challenge running"
          description="Pick one driver each Grand Prix to finish on the podium. Miss and you are out. Last one standing wins. The admins will announce the start."
        />
      </div>
    );
  }

  const winners = standings?.status === 'complete' ? standings.winners : null;

  return (
    <div className="w-full max-w-5xl mx-auto px-2 md:px-0 pb-24 md:pb-12 space-y-6">
      {header}
      {winners && (
        <Banner
          tone={winners.length ? 'success' : 'neutral'}
          title={winners.length ? `${winners.length > 1 ? 'Co-winners' : 'Winner'}: ${winners.map(u => names[u] || 'Unknown Team').join(', ')}` : 'No winner this time'}
          message={winners.length
            ? `Decided at ${eventName(standings!.decidedAt)}.`
            : `Everyone still standing went out together at ${eventName(standings!.decidedAt)}.`}
        />
      )}
      <SurvivalRoundCard
        user={user}
        config={config}
        standings={standings}
        myPicks={picks[user.id] || {}}
        round={round}
        rounds={rounds}
        isFinal={!!round && round.id === rounds[rounds.length - 1]?.id}
        drivers={allDrivers}
        constructors={allConstructors}
        formLocks={formLocks}
        eventName={eventName}
      />
      <SurvivalBoard
        config={config}
        standings={standings}
        picks={picks}
        names={names}
        rounds={rounds}
        round={winners ? null : round}
        drivers={allDrivers}
        formLocks={formLocks}
        currentUserId={user.id}
      />
    </div>
  );
};

export default SurvivalPage;
