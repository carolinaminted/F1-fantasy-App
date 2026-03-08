
export const LEAGUE_TIMEZONE = 'America/New_York';

/**
 * Robust parsing helper.
 * If the string lacks a timezone suffix (typical for datetime-local strings from Admin),
 * we parse it while forcing it into the League's context (America/New_York).
 */
export const parseLeagueDate = (isoString?: string): Date | null => {
    if (!isoString) return null;
    
    // 1. If it's already an absolute ISO string from constants (ends with Z)
    if (isoString.endsWith('Z')) return new Date(isoString);

    // 2. If it's a local string from Admin (e.g. 2026-03-29T14:00)
    // We must parse this as being in the context of the LEAGUE_TIMEZONE (EST/EDT)
    try {
        const normalized = isoString.replace(' ', 'T');
        // Simple but effective: treat the string as browser local, then adjust for the TZ difference
        const tempDate = new Date(normalized);
        
        // Get what time it is in the League Timezone when it is 'tempDate' in UTC (or local)
        // Actually, the logic from SchedulePage was:
        // tempDate (Local) -> leagueString (Time in NY) -> leagueDate (Local)
        // diff = tempDate - leagueDate
        // final = tempDate + diff
        
        // Let's re-verify this logic.
        // We want Final Date (UTC) such that Final Date in NY == Input String.
        
        // SchedulePage logic:
        // tempDate = Input String parsed as Local.
        // leagueString = tempDate formatted in NY.
        // leagueDate = leagueString parsed as Local.
        // diff = tempDate - leagueDate.
        // final = tempDate + diff.
        
        // Example: Input "03:30". Local = UTC.
        // tempDate = 03:30 UTC.
        // leagueString (NY time for 03:30 UTC) = 23:30 (Prev Day).
        // leagueDate = 23:30 UTC (Prev Day).
        // diff = 03:30 - 23:30 = +4 hours.
        // final = 03:30 UTC + 4h = 07:30 UTC.
        // 07:30 UTC in NY is 03:30. Correct.
        
        // Example 2: Input "03:30". Local = NY (Browser in NY).
        // tempDate = 03:30 NY (07:30 UTC).
        // leagueString (NY time for 07:30 UTC) = 03:30.
        // leagueDate = 03:30 NY (07:30 UTC).
        // diff = 0.
        // final = 07:30 UTC + 0 = 07:30 UTC.
        // Correct.
        
        const leagueString = tempDate.toLocaleString('en-US', { timeZone: LEAGUE_TIMEZONE });
        const leagueDate = new Date(leagueString);
        const diff = tempDate.getTime() - leagueDate.getTime();
        const finalDate = new Date(tempDate.getTime() + diff);
        
        return isNaN(finalDate.getTime()) ? null : finalDate;
    } catch (e) {
        const fallback = new Date(isoString);
        return isNaN(fallback.getTime()) ? null : fallback;
    }
};
