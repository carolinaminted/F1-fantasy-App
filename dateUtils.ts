import { LEAGUE_TIMEZONE } from './constants.ts';

export const parseLeagueDate = (isoString?: string): Date => {
    if (!isoString) return new Date();
    
    // 1. If it's already an absolute ISO string from constants (ends with Z)
    if (isoString.endsWith('Z')) return new Date(isoString);

    // 2. If it's a local string from Admin (e.g. 2026-03-29T14:00)
    try {
        const normalized = isoString.replace(' ', 'T');
        // Simple but effective: treat the string as browser local, then adjust for the TZ difference
        const tempDate = new Date(normalized);
        const leagueString = tempDate.toLocaleString('en-US', { timeZone: LEAGUE_TIMEZONE });
        const leagueDate = new Date(leagueString);
        const diff = tempDate.getTime() - leagueDate.getTime();
        const finalDate = new Date(tempDate.getTime() + diff);
        
        return isNaN(finalDate.getTime()) ? new Date(isoString) : finalDate;
    } catch (e) {
        return new Date(isoString);
    }
};
