
export const LEAGUE_TIMEZONE = 'America/New_York';

const LEAGUE_WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

const leagueParts = new Intl.DateTimeFormat('en-US', {
    timeZone: LEAGUE_TIMEZONE,
    hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
});

/** The league zone's offset from UTC at an instant, in ms (EDT is -4h). */
const leagueOffsetAt = (instant: number): number => {
    const p: Record<string, number> = {};
    leagueParts.formatToParts(new Date(instant)).forEach(({ type, value }) => { p[type] = Number(value); });
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - (instant - (instant % 1000));
};

/**
 * Reads a league wall-clock string — the schedule's and Admin's `2026-03-29T14:00`, always New
 * York time — as the instant it names, whatever zone the browser is in. Strings carrying their own
 * zone (`...Z`) are already absolute.
 *
 * The offset must be the one in force at the answer, not at the input read as some other zone's
 * time: the earlier version measured it at the latter, so any clock change between the two —
 * New York's, or the browser's own — put the result an hour out.
 */
export const parseLeagueDate = (isoString?: string): Date | null => {
    if (!isoString) return null;

    const m = LEAGUE_WALL_CLOCK.exec(isoString.trim());
    if (!m) {
        const absolute = new Date(isoString);
        return isNaN(absolute.getTime()) ? null : absolute;
    }

    const [, y, mo, d, h, mi, s = '0'] = m;
    const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
    const before = leagueOffsetAt(wall);
    const first = wall - before;
    const after = leagueOffsetAt(first);
    if (after === before) return new Date(first);
    // A clock change sits between the two guesses. If the post-change offset holds, that is the
    // answer; if not, the wall time fell in the spring-forward gap and never happened, and `first`
    // reads it on the pre-change offset — 02:30 becomes 03:30 EDT.
    const second = wall - after;
    return new Date(leagueOffsetAt(second) === after ? second : first);
};

/**
 * The league timezone's name *for a given date*, e.g. "Eastern Daylight Time" in October and
 * "Eastern Standard Time" in January. `short` gives EDT / EST.
 *
 * Exists because the label used to be hardcoded to "Eastern Standard Time", which is wrong from
 * mid-March to early November — most of a season. The times themselves were always right; only
 * the label lied. Derive it from the same date being displayed and the two cannot drift apart.
 */
export const leagueZoneName = (
    isoString?: string,
    style: 'short' | 'long' = 'long',
): string | null => {
    const date = parseLeagueDate(isoString);
    if (!date) return null;

    const part = new Intl.DateTimeFormat('en-US', {
        timeZone: LEAGUE_TIMEZONE,
        timeZoneName: style,
    })
        .formatToParts(date)
        .find(p => p.type === 'timeZoneName');

    return part?.value ?? null;
};

/**
 * A Firestore timestamp field as a Date. Tolerates a missing field, the null a pending server
 * timestamp reads as, and a plain {seconds} map left by a Database Manager edit.
 */
export const firestoreTimestampToDate = (value: unknown): Date | null => {
    const ts = value as { toDate?: () => Date; seconds?: number } | null | undefined;
    if (!ts) return null;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
    return null;
};

/** A pick's `submittedAt` as a Date; null for picks saved before the field existed. */
export const pickSubmittedAt = (picks?: { submittedAt?: unknown } | null): Date | null =>
    firestoreTimestampToDate(picks?.submittedAt);

/** "Oct 31, 11:46 AM EDT" in league time, labelled from the date itself so DST cannot drift. */
export const formatLeagueDateTime = (date: Date): string =>
    new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: LEAGUE_TIMEZONE,
        timeZoneName: 'short',
    }).format(date);
