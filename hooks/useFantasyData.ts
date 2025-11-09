// Fix: Add score calculation logic to process picks against race results and a points system.
import { useMemo, useCallback } from 'react';
import { CONSTRUCTORS, DRIVERS, USAGE_LIMITS, POINTS_SYSTEM } from '../constants';
import { EntityClass, PickSelection, UsageRollup, RaceResults, EventResult } from '../types';

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

export const calculateScoreRollup = (
  seasonPicks: { [eventId: string]: PickSelection },
  raceResults: RaceResults
) => {
    let grandPrixPoints = 0;
    let sprintPoints = 0;
    let fastestLapPoints = 0;
    let gpQualifyingPoints = 0;
    let sprintQualifyingPoints = 0;

    const getDriverPoints = (driverId: string | null, results: (string | null)[] | undefined, points: number[]) => {
      if (!driverId || !results) return 0;
      const pos = results.indexOf(driverId);
      return pos !== -1 ? (points[pos] || 0) : 0;
    };
    
    Object.entries(seasonPicks).forEach(([eventId, picks]) => {
      const results: EventResult | undefined = raceResults[eventId];
      if (!results) return; // No results for this event yet

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
    });

    const totalPoints = grandPrixPoints + sprintPoints + fastestLapPoints + gpQualifyingPoints + sprintQualifyingPoints;

    return { totalPoints, grandPrixPoints, sprintPoints, fastestLapPoints, gpQualifyingPoints, sprintQualifyingPoints };
};


const useFantasyData = (
    seasonPicks: { [eventId: string]: PickSelection },
    raceResults: RaceResults
) => {
  const data = useMemo(() => {
    const aTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.A);
    const bTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.B);
    const aDrivers = DRIVERS.filter(d => d.class === EntityClass.A);
    const bDrivers = DRIVERS.filter(d => d.class === EntityClass.B);
    return { aTeams, bTeams, aDrivers, bDrivers, allDrivers: DRIVERS, allConstructors: CONSTRUCTORS };
  }, []);

  const usageRollup = useMemo(() => calculateUsageRollup(seasonPicks), [seasonPicks]);
  const scoreRollup = useMemo(() => calculateScoreRollup(seasonPicks, raceResults), [seasonPicks, raceResults]);


  const getUsage = useCallback((id: string, type: 'teams' | 'drivers'): number => {
    return usageRollup[type][id] || 0;
  }, [usageRollup]);

  const getLimit = useCallback((entityClass: EntityClass, type: 'teams' | 'drivers'): number => {
    return USAGE_LIMITS[entityClass][type];
  }, []);

  const hasRemaining = useCallback((id: string, type: 'teams' | 'drivers'): boolean => {
    const entityList = type === 'teams' ? CONSTRUCTORS : DRIVERS;
    const entity = entityList.find(e => e.id === id);
    if (!entity) return false;

    const usage = getUsage(id, type);
    const limit = getLimit(entity.class, type);
    return usage < limit;
  }, [getLimit, getUsage]);

  return { ...data, getUsage, getLimit, hasRemaining, usageRollup, scoreRollup };
};

export default useFantasyData;