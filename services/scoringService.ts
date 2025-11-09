import { DRIVERS, POINTS_SYSTEM } from '../constants';
import { PickSelection, RaceResults, EventResult, UsageRollup } from '../types';

export const calculateUsageRollup = (seasonPicks: { [eventId: string]: PickSelection }): UsageRollup => {
    const teams: { [id: string]: number } = {};
    const drivers: { [id: string]: number } = {};

    Object.values(seasonPicks).forEach(p => {
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

// Fix: Extract per-event scoring logic into a reusable function.
export const calculatePointsForEvent = (
  picks: PickSelection,
  results: EventResult
) => {
    let grandPrixPoints = 0;
    let sprintPoints = 0;
    let fastestLapPoints = 0;
    let gpQualifyingPoints = 0;
    let sprintQualifyingPoints = 0;

    // Create a unique set of all drivers that can score points from this pick to avoid double counting.
    const scoringDriverIds = new Set<string>();

    // Add individually picked drivers
    [...picks.aDrivers, ...picks.bDrivers].forEach(driverId => {
      if (driverId) scoringDriverIds.add(driverId);
    });
    
    // Add drivers from picked teams
    [...picks.aTeams, picks.bTeam].forEach(teamId => {
      if (teamId) {
        DRIVERS.forEach(driver => {
          if (driver.constructorId === teamId) {
            scoringDriverIds.add(driver.id);
          }
        });
      }
    });

    // Calculate points based on the unique set of drivers
    scoringDriverIds.forEach(driverId => {
      grandPrixPoints += getDriverPoints(driverId, results.grandPrixFinish, POINTS_SYSTEM.grandPrixFinish);
      if (results.sprintFinish) {
        sprintPoints += getDriverPoints(driverId, results.sprintFinish, POINTS_SYSTEM.sprintFinish);
      }
      gpQualifyingPoints += getDriverPoints(driverId, results.gpQualifying, POINTS_SYSTEM.gpQualifying);
      if(results.sprintQualifying) {
         sprintQualifyingPoints += getDriverPoints(driverId, results.sprintQualifying, POINTS_SYSTEM.sprintQualifying);
      }
    });
    
    // Fastest Lap is separate and awarded only if the picked driver got it
    if (picks.fastestLap === results.fastestLap) {
      fastestLapPoints += POINTS_SYSTEM.fastestLap;
    }
    
    const totalPoints = grandPrixPoints + sprintPoints + fastestLapPoints + gpQualifyingPoints + sprintQualifyingPoints;

    return { totalPoints, grandPrixPoints, sprintPoints, fastestLapPoints, gpQualifyingPoints, sprintQualifyingPoints };
};

export const calculateScoreRollup = (
  seasonPicks: { [eventId: string]: PickSelection },
  raceResults: RaceResults
) => {
    let grandPrixPoints = 0;
    let sprintPoints = 0;
    let fastestLapPoints = 0;
    let gpQualifyingPoints = 0;
    let sprintQualifyingPoints = 0;

    
    Object.entries(seasonPicks).forEach(([eventId, picks]) => {
      const results: EventResult | undefined = raceResults[eventId];
      if (!results) return; // No results for this event yet

      const eventPoints = calculatePointsForEvent(picks, results);
      
      grandPrixPoints += eventPoints.grandPrixPoints;
      sprintPoints += eventPoints.sprintPoints;
      fastestLapPoints += eventPoints.fastestLapPoints;
      gpQualifyingPoints += eventPoints.gpQualifyingPoints;
      sprintQualifyingPoints += eventPoints.sprintQualifyingPoints;
    });

    const totalPoints = grandPrixPoints + sprintPoints + fastestLapPoints + gpQualifyingPoints + sprintQualifyingPoints;

    return { totalPoints, grandPrixPoints, sprintPoints, fastestLapPoints, gpQualifyingPoints, sprintQualifyingPoints };
};
