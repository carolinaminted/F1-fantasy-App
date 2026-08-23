import { Event, EventResult, RaceResults } from '../types.ts';
import { parseLeagueDate } from './dateUtils.ts';

/**
 * When the race itself runs. `raceAtUtc` comes from the imported schedule; `lockAtUtc` (the
 * picks deadline, normally qualifying) is the fallback for events with no schedule yet.
 */
const raceTime = (event: Event) =>
    parseLeagueDate(event.raceAtUtc || event.lockAtUtc)?.getTime() || 0;

/** True once a race has actually been run. */
export const hasRaceRun = (event: Event, now: number = Date.now()) => raceTime(event) <= now;

/**
 * Whether a race has been scored. Any entered finishing order counts — a race with only the
 * sprint filled in is still a race someone has started working on.
 */
export const hasEventResults = (results?: EventResult): boolean => {
    if (!results) return false;
    return !!(
        results.grandPrixFinish?.some(pos => !!pos) ||
        results.fastestLap ||
        results.sprintFinish?.some(pos => !!pos) ||
        results.gpQualifying?.some(pos => !!pos) ||
        results.sprintQualifying?.some(pos => !!pos)
    );
};

export type EventStatus = 'upcoming' | 'completed' | 'cancelled' | 'unscored';

export interface EventStatusContext {
    raceResults?: RaceResults;
    cancelledEventIds?: Set<string>;
    now?: number;
}

/**
 * The single definition of where a race belongs, shared by every race-weekend picker.
 *
 * - `upcoming`  — genuinely still to come: not yet run, not cancelled, not scored.
 * - `completed` — scored, and not cancelled. Scoring is what finishes a race, not the calendar.
 * - `cancelled` — called off; shown only under All, carrying its own chip.
 * - `unscored`  — it has run but no results are in yet. Deliberately in neither Upcoming nor
 *                 Completed, so it surfaces under All until an admin scores it.
 */
export const classifyEvent = (event: Event, ctx: EventStatusContext = {}): EventStatus => {
    const { raceResults, cancelledEventIds, now = Date.now() } = ctx;

    if (cancelledEventIds?.has(event.id)) return 'cancelled';
    if (hasEventResults(raceResults?.[event.id])) return 'completed';
    return hasRaceRun(event, now) ? 'unscored' : 'upcoming';
};

/** The three toggles every race picker shows. Defined once so the labels cannot drift. */
export const EVENT_FILTERS = [
    { label: 'Upcoming', value: 'upcoming' },
    { label: 'Completed', value: 'completed' },
    { label: 'All', value: 'all' },
] as const;

export type EventFilterValue = typeof EVENT_FILTERS[number]['value'];

/** Whether a race belongs under the given tab. `all` holds everything. */
export const matchesEventFilter = (
    event: Event,
    filter: string,
    ctx: EventStatusContext = {}
): boolean => {
    if (filter === 'all') return true;
    return classifyEvent(event, ctx) === filter;
};

/**
 * The next race first, then the rest of the season in calendar order, then finished races
 * most-recent-first. Every race-weekend picker in the app opens on the weekend everyone is
 * actually thinking about rather than on Round 1 from months ago.
 */
export const orderEventsUpcomingFirst = (events: Event[], now: number = Date.now()): Event[] => {
    const upcoming = events.filter(e => raceTime(e) > now).sort((a, b) => raceTime(a) - raceTime(b));
    const past = events.filter(e => raceTime(e) <= now).sort((a, b) => raceTime(b) - raceTime(a));
    return [...upcoming, ...past];
};

/** The next race still to be run, if the season has one left. */
export const findNextEvent = (events: Event[], now: number = Date.now()): Event | undefined =>
    orderEventsUpcomingFirst(events, now).find(e => raceTime(e) > now);
