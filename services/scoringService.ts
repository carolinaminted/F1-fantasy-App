import { EntityClass } from '../types.ts';
import type { PickSelection, RaceResults, EventResult, UsageRollup, ClassUsage, PointsSystem, Driver, Constructor, EventPointsBreakdown, User } from '../types.ts';
import type { ScoredEventIds } from './seasonConfig.ts';

/**
 * Tally season selections per entity *and per class*.
 *
 * Which slot array an id sits in is the record of the class it was picked under, so a driver
 * promoted from B to A mid-season accrues against two independent budgets. Flattening the four
 * arrays into one count per id — as this used to — charged his Class A picks against his Class B
 * allowance the moment he was demoted again.
 *
 * `excludeEventId` drops one event from the tally. Pre-submit validation needs it: the lineup
 * being edited is already saved, so counting it would reject every re-save of an at-limit lineup,
 * including a no-op one. Display never passes it.
 */
export const calculateUsageRollup = (
    seasonPicks: { [eventId: string]: PickSelection },
    scoredEventIds: ScoredEventIds,
    cancelledEventIds: Set<string> = new Set(),
    excludeEventId?: string
): UsageRollup => {
    const teams: { [id: string]: ClassUsage } = {};
    const drivers: { [id: string]: ClassUsage } = {};

    const bump = (bucket: { [id: string]: ClassUsage }, id: string, cls: EntityClass) => {
        const entry = bucket[id] || (bucket[id] = { [EntityClass.A]: 0, [EntityClass.B]: 0 });
        entry[cls] += 1;
    };

    Object.entries(seasonPicks).forEach(([eventId, p]) => {
        // Only events the season config names count — picks outlive the calendar
        if (!scoredEventIds.has(eventId)) return;
        // Skip cancelled events — picks don't count against quotas
        if (cancelledEventIds.has(eventId)) return;
        // Skip the event under edit, when the caller is computing a pre-submit baseline
        if (excludeEventId && eventId === excludeEventId) return;

        p.aTeams.forEach(id => { if(id) bump(teams, id, EntityClass.A); });
        if (p.bTeam) bump(teams, p.bTeam, EntityClass.B);
        p.aDrivers.forEach(id => { if(id) bump(drivers, id, EntityClass.A); });
        p.bDrivers.forEach(id => { if(id) bump(drivers, id, EntityClass.B); });
    });
    
    return { teams, drivers };
};

const getDriverPoints = (driverId: string | null, results: (string | null)[] | undefined, points: number[]) => {
  if (!driverId || !results || !points) return 0;
  const pos = results.indexOf(driverId);
  return pos !== -1 ? (points[pos] || 0) : 0;
};

export const calculatePointsForEvent = (
  picks: PickSelection,
  results: EventResult,
  activeSystem: PointsSystem,
  driversList: Driver[]
): EventPointsBreakdown => {
    // --- SCORING SNAPSHOT LOGIC ---
    // If the result has a specific scoring snapshot saved, use it.
    // Otherwise, fallback to the currently active system passed in.
    const pointsSystem = results.scoringSnapshot || activeSystem;

    // --- Data structures to hold points per entity ---
    const teamScores: Record<string, { gp: number, sprint: number, gpQuali: number, sprintQuali: number }> = {};
    
    // Helper: Initialize score object if missing
    const initTeamScore = (id: string) => {
        if (!teamScores[id]) teamScores[id] = { gp: 0, sprint: 0, gpQuali: 0, sprintQuali: 0 };
    };

    // Helper: Resolve Constructor ID (Snapshot -> Fallback)
    const getConstructorForDriver = (driverId: string): string | undefined => {
        // Priority 1: Use the snapshot stored with the results (historical accuracy)
        if (results.driverTeams && results.driverTeams[driverId]) {
            return results.driverTeams[driverId];
        }
        // Priority 2: Fallback to dynamic driver list passed in
        return driversList.find(d => d.id === driverId)?.constructorId;
    };

    // --- 1. SCAN RESULTS & AWARD POINTS TO TEAMS ---
    // Instead of iterating user picks, we iterate the RESULTS.

    const awardTeamPoints = (driverId: string | null, posIndex: number, pointsArray: number[], type: 'gp'|'sprint'|'gpQuali'|'sprintQuali') => {
        if (!driverId) return;
        const constructorId = getConstructorForDriver(driverId);
        if (constructorId) {
            initTeamScore(constructorId);
            // Defensive check: ensure pointsArray exists before accessing index
            const points = (pointsArray && pointsArray[posIndex]) ? pointsArray[posIndex] : 0;
            teamScores[constructorId][type] += points;
        }
    };

    // Scan Grand Prix
    if (results.grandPrixFinish) {
        results.grandPrixFinish.forEach((dId, idx) => awardTeamPoints(dId, idx, pointsSystem.grandPrixFinish, 'gp'));
    }
    // Scan Sprint
    if (results.sprintFinish) {
        results.sprintFinish.forEach((dId, idx) => awardTeamPoints(dId, idx, pointsSystem.sprintFinish, 'sprint'));
    }
    // Scan GP Quali
    if (results.gpQualifying) {
        results.gpQualifying.forEach((dId, idx) => awardTeamPoints(dId, idx, pointsSystem.gpQualifying, 'gpQuali'));
    }
    // Scan Sprint Quali
    if (results.sprintQualifying) {
        results.sprintQualifying.forEach((dId, idx) => awardTeamPoints(dId, idx, pointsSystem.sprintQualifying, 'sprintQuali'));
    }

    // --- 2. CALCULATE USER TOTALS FROM PICKS ---

    let teamGrandPrixPoints = 0;
    let teamSprintPoints = 0;
    let teamGpQualifyingPoints = 0;
    let teamSprintQualifyingPoints = 0;

    // Sum Team Points
    const pickedTeams = [...(picks.aTeams || []), picks.bTeam].filter(Boolean) as string[];
    pickedTeams.forEach(teamId => {
        const scores = teamScores[teamId];
        if (scores) {
            teamGrandPrixPoints += scores.gp;
            teamSprintPoints += scores.sprint;
            teamGpQualifyingPoints += scores.gpQuali;
            teamSprintQualifyingPoints += scores.sprintQuali;
        }
    });

    // Sum Driver Points
    let driverGrandPrixPoints = 0;
    let driverSprintPoints = 0;
    let driverGpQualifyingPoints = 0;
    let driverSprintQualifyingPoints = 0;

    const allPickedDrivers = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean) as string[];
    allPickedDrivers.forEach(driverId => {
        driverGrandPrixPoints += getDriverPoints(driverId, results.grandPrixFinish, pointsSystem.grandPrixFinish);
        if (results.sprintFinish) {
            driverSprintPoints += getDriverPoints(driverId, results.sprintFinish, pointsSystem.sprintFinish);
        }
        driverGpQualifyingPoints += getDriverPoints(driverId, results.gpQualifying, pointsSystem.gpQualifying);
        if (results.sprintQualifying) {
            driverSprintQualifyingPoints += getDriverPoints(driverId, results.sprintQualifying, pointsSystem.sprintQualifying);
        }
    });

    // Fastest Lap
    let fastestLapPoints = 0;
    if (picks.fastestLap && picks.fastestLap === results.fastestLap) {
        fastestLapPoints = pointsSystem.fastestLap || 0;
    }

    // P22 Tracker (No Points, Just Count)
    let p22Count = 0;
    if (results.p22Driver && allPickedDrivers.includes(results.p22Driver)) {
        p22Count = 1;
    }

    const grandPrixPoints = teamGrandPrixPoints + driverGrandPrixPoints;
    const sprintPoints = teamSprintPoints + driverSprintPoints;
    const gpQualifyingPoints = teamGpQualifyingPoints + driverGpQualifyingPoints;
    const sprintQualifyingPoints = teamSprintQualifyingPoints + driverSprintQualifyingPoints;

    const rawTotal = grandPrixPoints + sprintPoints + gpQualifyingPoints + sprintQualifyingPoints + fastestLapPoints;

    // --- 3. APPLY PENALTIES ---
    // If penalty exists (0.2 for 20%), deduct from total
    let penaltyPoints = 0;
    let totalPoints = rawTotal;

    if (picks.penalty && picks.penalty > 0) {
        penaltyPoints = Math.ceil(rawTotal * picks.penalty); // Use ceil to be strict (round up the penalty)
        totalPoints = rawTotal - penaltyPoints;
    }

    return { totalPoints, grandPrixPoints, sprintPoints, fastestLapPoints, gpQualifyingPoints, sprintQualifyingPoints, penaltyPoints, p22Count };
};

export const calculateScoreRollup = (
  seasonPicks: { [eventId: string]: PickSelection },
  raceResults: RaceResults,
  pointsSystem: PointsSystem,
  driversList: Driver[],
  scoredEventIds: ScoredEventIds,
  cancelledEventIds: Set<string> = new Set()
) => {
    let grandPrixPoints = 0;
    let sprintPoints = 0;
    let fastestLapPoints = 0;
    let gpQualifyingPoints = 0;
    let sprintQualifyingPoints = 0;
    let penaltyPoints = 0;
    let totalPoints = 0;
    let p22Count = 0;

    Object.entries(seasonPicks).forEach(([eventId, picks]) => {
      // Only events the season config names count — picks outlive the calendar
      if (!scoredEventIds.has(eventId)) return;
      // Skip cancelled events — no points awarded
      if (cancelledEventIds.has(eventId)) return;

      const results: EventResult | undefined = raceResults[eventId];
      if (!results) return; // No results for this event yet

      const eventPoints = calculatePointsForEvent(picks, results, pointsSystem, driversList);
      
      grandPrixPoints += eventPoints.grandPrixPoints;
      sprintPoints += eventPoints.sprintPoints;
      fastestLapPoints += eventPoints.fastestLapPoints;
      gpQualifyingPoints += eventPoints.gpQualifyingPoints;
      sprintQualifyingPoints += eventPoints.sprintQualifyingPoints;
      penaltyPoints += eventPoints.penaltyPoints;
      totalPoints += eventPoints.totalPoints;
      p22Count += eventPoints.p22Count;
    });

    return { totalPoints, grandPrixPoints, sprintPoints, fastestLapPoints, gpQualifyingPoints, sprintQualifyingPoints, penaltyPoints, p22Count };
};

/**
 * Shapes public_users rows for the leaderboard views. Points, breakdown and rank are all
 * server-calculated (recalculateEntireLeague) and shown as stored: the client never scores or
 * ranks the league, so Standings and the Dashboard cannot disagree. Rows arrive already ordered
 * by totalPoints from the query.
 */
export const processLeaderboardStats = (users: User[], currentUser: User | null): User[] =>
    users.map(user => ({
        ...user,
        // Show a just-edited name before the next recalc repairs public_users.
        displayName: currentUser && user.id === currentUser.id ? currentUser.displayName : user.displayName,
        totalPoints: user.totalPoints ?? 0,
        breakdown: { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0, ...user.breakdown },
        displayRank: user.rank,
    }));
