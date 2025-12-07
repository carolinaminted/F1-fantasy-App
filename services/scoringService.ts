
import { DRIVERS } from '../constants';
import { PickSelection, RaceResults, EventResult, UsageRollup, PointsSystem } from '../types';

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

export const calculatePointsForEvent = (
  picks: PickSelection,
  results: EventResult,
  pointsSystem: PointsSystem
) => {
    let teamGrandPrixPoints = 0;
    let driverGrandPrixPoints = 0;
    let teamSprintPoints = 0;
    let driverSprintPoints = 0;
    let teamGpQualifyingPoints = 0;
    let driverGpQualifyingPoints = 0;
    let teamSprintQualifyingPoints = 0;
    let driverSprintQualifyingPoints = 0;
    let fastestLapPoints = 0;

    const allPickedTeams = [...(picks.aTeams || []), picks.bTeam].filter(Boolean) as string[];
    const allPickedDrivers = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean) as string[];

    // --- Team Points (Additive) ---
    allPickedTeams.forEach(teamId => {
        DRIVERS.forEach(driver => {
            if (driver.constructorId === teamId) {
                teamGrandPrixPoints += getDriverPoints(driver.id, results.grandPrixFinish, pointsSystem.grandPrixFinish);
                if (results.sprintFinish) {
                    teamSprintPoints += getDriverPoints(driver.id, results.sprintFinish, pointsSystem.sprintFinish);
                }
                teamGpQualifyingPoints += getDriverPoints(driver.id, results.gpQualifying, pointsSystem.gpQualifying);
                if (results.sprintQualifying) {
                    teamSprintQualifyingPoints += getDriverPoints(driver.id, results.sprintQualifying, pointsSystem.sprintQualifying);
                }
            }
        });
    });

    // --- Driver Points (Additive) ---
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

    // --- Fastest Lap ---
    if (picks.fastestLap === results.fastestLap) {
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
  pointsSystem: PointsSystem
) => {
    let grandPrixPoints = 0;
    let sprintPoints = 0;
    let fastestLapPoints = 0;
    let gpQualifyingPoints = 0;
    let sprintQualifyingPoints = 0;

    
    Object.entries(seasonPicks).forEach(([eventId, picks]) => {
      const results: EventResult | undefined = raceResults[eventId];
      if (!results) return; // No results for this event yet

      const eventPoints = calculatePointsForEvent(picks, results, pointsSystem);
      
      grandPrixPoints += eventPoints.grandPrixPoints;
      sprintPoints += eventPoints.sprintPoints;
      fastestLapPoints += eventPoints.fastestLapPoints;
      gpQualifyingPoints += eventPoints.gpQualifyingPoints;
      sprintQualifyingPoints += eventPoints.sprintQualifyingPoints;
    });

    const totalPoints = grandPrixPoints + sprintPoints + fastestLapPoints + gpQualifyingPoints + sprintQualifyingPoints;

    return { totalPoints, grandPrixPoints, sprintPoints, fastestLapPoints, gpQualifyingPoints, sprintQualifyingPoints };
};
