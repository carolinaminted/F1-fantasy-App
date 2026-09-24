import type { Event, RaceResults, SurvivalConfig } from '../types.ts';
import { parseLeagueDate } from './dateUtils.ts';

/** Mirrors MAX_DRIVER_USES in functions/survival.js. */
export const SURVIVAL_MAX_USES = 3;

/** The challenge's rounds in calendar order: from the start event on, cancelled ones dropped. */
export const survivalRounds = (events: Event[], config: SurvivalConfig | null, cancelledEventIds: Set<string>): Event[] => {
    if (!config?.startEventId) return [];
    const start = events.findIndex(e => e.id === config.startEventId);
    if (start === -1) return [];
    return events.slice(start).filter(e => !cancelledEventIds.has(e.id));
};

const hasGpResult = (raceResults: RaceResults, eventId: string) =>
    !!raceResults[eventId]?.grandPrixFinish?.some(Boolean);

/** The round being played: the first one without a Grand Prix result. */
export const currentSurvivalRound = (rounds: Event[], raceResults: RaceResults): Event | null =>
    rounds.find(e => !hasGpResult(raceResults, e.id)) ?? null;

export const isEventLocked = (event: Event, formLocks: { [eventId: string]: boolean }): boolean => {
    if (formLocks[event.id]) return true;
    const lock = parseLeagueDate(event.lockAtUtc);
    return lock ? lock.getTime() <= Date.now() : false;
};
