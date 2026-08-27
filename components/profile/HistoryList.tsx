import React, { useState } from 'react';
import { Tile, SectionHeader, Chip, EmptyState, CATEGORY_THEME, NUMERIC, type Category } from '../ui/index.ts';
import { ChevronDownIcon } from '../icons/ChevronDownIcon.tsx';
import { CheckeredFlagIcon } from '../icons/CheckeredFlagIcon.tsx';
import { SprintIcon } from '../icons/SprintIcon.tsx';
import { PolePositionIcon } from '../icons/PolePositionIcon.tsx';
import { FastestLapIcon } from '../icons/FastestLapIcon.tsx';
import { PicksIcon } from '../icons/PicksIcon.tsx';
import { HistoryIcon } from '../icons/HistoryIcon.tsx';
import { PenaltyManager } from './PenaltyManager.tsx';
import { calculatePointsForEvent } from '../../services/scoringService.ts';
import { CURRENT_SEASON } from '../../constants.ts';
import type { Event, PickSelection, RaceResults, PointsSystem, Driver } from '../../types.ts';

export type EventCategory = 'gp' | 'sprint' | 'quali' | 'fl' | 'sprintQuali';

interface HistoryListProps {
  events: Event[];
  seasonPicks: { [eventId: string]: PickSelection };
  raceResults: RaceResults;
  pointsSystem: PointsSystem;
  allDrivers: Driver[];
  getEntityName: (id: string | null) => string;
  onDetailClick: (eventId: string, category: EventCategory) => void;
  onUpdatePenalty?: (eventId: string, penalty: number, reason: string) => Promise<void>;
  isPublicView: boolean;
}

const PointChip: React.FC<{
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  points: number;
  category: Category;
  onClick: () => void;
}> = ({ icon: Icon, label, points, category, onClick }) => (
  <button
    onClick={onClick}
    className="flex w-28 flex-col items-center justify-center rounded-lg border border-pure-white/5 bg-carbon-black/50 p-2 transition-colors hover:border-pure-white/20 hover:bg-carbon-black"
  >
    <Icon className={`mb-1 h-5 w-5 ${CATEGORY_THEME[category].text}`} />
    <span className="text-[10px] uppercase tracking-wider text-highlight-silver">{label}</span>
    <span className={`text-lg font-black text-pure-white ${NUMERIC}`}>{points}</span>
  </button>
);

/**
 * Picks & points, event by event. Every figure comes from `calculatePointsForEvent` on the
 * picks and results already in memory, exactly as before the Gate 12 restyle; the penalty
 * stamp became a Chip and the category chips finally wear the category colors.
 */
export const HistoryList: React.FC<HistoryListProps> = ({
  events, seasonPicks, raceResults, pointsSystem, allDrivers,
  getEntityName, onDetailClick, onUpdatePenalty, isPublicView,
}) => {
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const hasHistory = events.some(event => seasonPicks[event.id]);

  return (
    <div>
      <SectionHeader
        title="Picks & Points History"
        subtitle="Every submitted lineup, race by race"
        icon={HistoryIcon}
      />

      {!hasHistory && (
        <Tile padding="none">
          <EmptyState
            icon={PicksIcon}
            title="No History Yet"
            description={`Your Grand Prix picks and scoring results will appear here once you submit your first entry for the ${CURRENT_SEASON} season.`}
          />
        </Tile>
      )}

      <div className="space-y-2">
        {events.map(event => {
          const picks = seasonPicks[event.id];
          const results = raceResults[event.id];
          if (!picks) return null;

          const eventPoints = results
            ? calculatePointsForEvent(picks, results, pointsSystem, allDrivers)
            : { totalPoints: 0, grandPrixPoints: 0, sprintPoints: 0, gpQualifyingPoints: 0, sprintQualifyingPoints: 0, fastestLapPoints: 0, penaltyPoints: 0 };
          const isExpanded = expandedEvent === event.id;
          const hasPenalty = (picks.penalty || 0) > 0;
          const rawPoints = eventPoints.totalPoints + (eventPoints.penaltyPoints || 0);

          return (
            <Tile key={event.id} padding="none" className="overflow-hidden">
              <button
                className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-pure-white/5"
                onClick={() => setExpandedEvent(prev => (prev === event.id ? null : event.id))}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-bold text-pure-white">
                      R{event.round}: {event.name}
                    </h3>
                    {hasPenalty && (
                      <Chip
                        label={`Penalty −${((picks.penalty || 0) * 100).toFixed(0)}%`}
                        tone="danger" size="xs"
                      />
                    )}
                  </div>
                  <p className="text-xs text-highlight-silver">{event.country}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="text-right">
                    <span className={`block text-xl font-black text-pure-white ${NUMERIC}`}>
                      {eventPoints.totalPoints}
                      <span className="ml-1 text-[10px] font-bold uppercase text-highlight-silver">pts</span>
                    </span>
                    {hasPenalty && <span className="block text-[10px] font-bold text-primary-red">Adjusted</span>}
                  </div>
                  <ChevronDownIcon className={`w-5 h-5 text-highlight-silver transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-pure-white/10 bg-carbon-black/40 p-4 text-sm">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-highlight-silver">Teams</h4>
                      <p className="text-ghost-white">A: {getEntityName(picks.aTeams[0])}, {getEntityName(picks.aTeams[1])}</p>
                      <p className="text-ghost-white">B: {getEntityName(picks.bTeam)}</p>
                    </div>
                    <div>
                      <h4 className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-highlight-silver">Drivers</h4>
                      <p className="text-ghost-white">A: {getEntityName(picks.aDrivers[0])}, {getEntityName(picks.aDrivers[1])}, {getEntityName(picks.aDrivers[2])}</p>
                      <p className="text-ghost-white">B: {getEntityName(picks.bDrivers[0])}, {getEntityName(picks.bDrivers[1])}</p>
                    </div>
                    <div className="md:col-span-2">
                      <h4 className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-highlight-silver">Fastest Lap</h4>
                      <p className="text-ghost-white">{getEntityName(picks.fastestLap)}</p>
                    </div>
                  </div>

                  {results && (
                    <div className="mt-4 border-t border-pure-white/10 pt-4">
                      <div className="flex flex-wrap justify-center gap-3">
                        <PointChip icon={CheckeredFlagIcon} label="GP Finish" category="gp"
                          points={eventPoints.grandPrixPoints}
                          onClick={() => onDetailClick(event.id, 'gp')} />
                        {event.hasSprint && (
                          <PointChip icon={SprintIcon} label="Sprint" category="sprint"
                            points={eventPoints.sprintPoints}
                            onClick={() => onDetailClick(event.id, 'sprint')} />
                        )}
                        <PointChip icon={PolePositionIcon} label="Quali" category="quali"
                          points={eventPoints.gpQualifyingPoints}
                          onClick={() => onDetailClick(event.id, 'quali')} />
                        {event.hasSprint && results.sprintQualifying && (
                          <PointChip icon={SprintIcon} label="Sprint Quali" category="sprint"
                            points={eventPoints.sprintQualifyingPoints}
                            onClick={() => onDetailClick(event.id, 'sprintQuali')} />
                        )}
                        <PointChip icon={FastestLapIcon} label="Fastest Lap" category="fl"
                          points={eventPoints.fastestLapPoints}
                          onClick={() => onDetailClick(event.id, 'fl')} />
                      </div>

                      {hasPenalty && (
                        <div className="mt-4 rounded-lg border border-primary-red/30 bg-primary-red/[0.08] p-3 text-center">
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-highlight-silver">Score Adjustment</p>
                          <div className={`flex items-center justify-center gap-2 text-sm ${NUMERIC}`}>
                            <span className="text-ghost-white">{rawPoints} raw</span>
                            <span className="text-highlight-silver">−</span>
                            <span className="font-bold text-primary-red">{eventPoints.penaltyPoints} penalty</span>
                            <span className="text-highlight-silver">=</span>
                            <span className="font-bold text-pure-white">{eventPoints.totalPoints} pts</span>
                          </div>
                          {picks.penaltyReason && (
                            <p className="mt-1 text-xs italic text-primary-red/80">"{picks.penaltyReason}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {onUpdatePenalty && !isPublicView && (
                    <PenaltyManager
                      eventId={event.id}
                      currentPenalty={picks.penalty || 0}
                      currentReason={picks.penaltyReason}
                      onSave={onUpdatePenalty}
                    />
                  )}
                </div>
              )}
            </Tile>
          );
        })}
      </div>
    </div>
  );
};
