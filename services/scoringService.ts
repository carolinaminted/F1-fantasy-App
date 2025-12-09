
import { EVENTS } from '../constants.ts';
import { PickSelection, RaceResults, EventResult, UsageRollup, PointsSystem, Driver, Constructor } from '../types.ts';

const CURRENT_EVENT_IDS = new Set(EVENTS.map(e => e.id));

export const calculateUsageRollup = (seasonPicks: { [eventId: string]: PickSelection }): UsageRollup => {
    const teams: { [id: string]: number } = {};
    const drivers: { [id: string]: number } = {};

    Object.entries(seasonPicks).forEach(([eventId, p]) => {
        // Ignore picks from previous seasons
        if (!CURRENT_EVENT_IDS.has(eventId)) return;

        p.aTeams.forEach(id => { if(id) teams[id] = (teams[id] || 0) + 1; });
        if (p.bTeam) teams[p.bTeam] = (teams[p.bTeam] || 0) + 1;
        p.aDrivers.forEach(id => { if(id) drivers[id] = (drivers[id] || 0) + 1; });
        p.bDrivers.forEach(id => { if(id) drivers[id] = (drivers[id] || 0) + 1; });
    });
    
    return { teams, drivers };
};

const getDriverPoints = (driverId: string | null, results: (string | null)[] | undefined, points: number[]) => {
  if (!driverId || !results) return 0;
  const pos = results.indexOf(driverId);
  return pos !== -1 ? (points[pos] || 0) : 0;
};

export const calculatePointsForEvent = (
  picks: PickSelection,
  results: EventResult,
  pointsSystem: PointsSystem,
  driversList: Driver[]
) => {
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
            const points = pointsArray[posIndex] || 0;
            teamScores[constructorId][type] += points;
        }
    };

    // Scan Grand Prix
    results.grandPrixFinish.forEach((dId, idx) => awardTeamPoints(dId, idx, pointsSystem.grandPrixFinish, 'gp'));
    // Scan Sprint
    if (results.sprintFinish) {
        results.sprintFinish.forEach((dId, idx) => awardTeamPoints(dId, idx, pointsSystem.sprintFinish, 'sprint'));
    }
    // Scan GP Quali
    results.gpQualifying.forEach((dId, idx) => awardTeamPoints(dId, idx, pointsSystem.gpQualifying, 'gpQuali'));
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
    const pickedTeams = [...picks.aTeams, picks.bTeam].filter(Boolean) as string[];
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
        fastestLapPoints = pointsSystem.fastestLap;
    }

    const grandPrixPoints = teamGrandPrixPoints + driverGrandPrixPoints;
    const sprintPoints = teamSprintPoints + driverSprintPoints;
    const gpQualifyingPoints = teamGpQualifyingPoints + driverGpQualifyingPoints;
    const sprintQualifyingPoints = teamSprintQualifyingPoints + driverSprintQualifyingPoints;

    const totalPoints = grandPrixPoints + sprintPoints + gpQualifyingPoints + sprintQualifyingPoints + fastestLapPoints;

    return { totalPoints, grandPrixPoints, sprintPoints, fastestLapPoints, gpQualifyingPoints, sprintQualifyingPoints };
};

export const calculateScoreRollup = (
  seasonPicks: { [eventId: string]: PickSelection },
  raceResults: RaceResults,
  pointsSystem: PointsSystem,
  driversList: Driver[]
) => {
    let grandPrixPoints = 0;
    let sprintPoints = 0;
    let fastestLapPoints = 0;
    let gpQualifyingPoints = 0;
    let sprintQualifyingPoints = 0;

    Object.entries(seasonPicks).forEach(([eventId, picks]) => {
      // Filter: Only include events that are in the current season configuration
      if (!CURRENT_EVENT_IDS.has(eventId)) return;

      const results: EventResult | undefined = raceResults[eventId];
      if (!results) return; // No results for this event yet

      const eventPoints = calculatePointsForEvent(picks, results, pointsSystem, driversList);
      
      grandPrixPoints += eventPoints.grandPrixPoints;
      sprintPoints += eventPoints.sprintPoints;
      fastestLapPoints += eventPoints.fastestLapPoints;
      gpQualifyingPoints += eventPoints.gpQualifyingPoints;
      sprintQualifyingPoints += eventPoints.sprintQualifyingPoints;
    });

    const totalPoints = grandPrixPoints + sprintPoints + fastestLapPoints + gpQualifyingPoints + sprintQualifyingPoints;

    return { totalPoints, grandPrixPoints, sprintPoints, fastestLapPoints, gpQualifyingPoints, sprintQualifyingPoints };
};
