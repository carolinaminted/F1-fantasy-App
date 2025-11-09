// Fix: Add score calculation logic to process picks against race results and a points system.
import { useMemo, useCallback } from 'react';
import { CONSTRUCTORS, DRIVERS, USAGE_LIMITS, POINTS_SYSTEM, MOCK_RACE_RESULTS } from '../constants';
import { EntityClass, PickSelection, Driver } from '../types';

const useFantasyData = (seasonPicks: { [eventId: string]: PickSelection }) => {
  const data = useMemo(() => {
    const aTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.A);
    const bTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.B);
    const aDrivers = DRIVERS.filter(d => d.class === EntityClass.A);
    const bDrivers = DRIVERS.filter(d => d.class === EntityClass.B);
    return { aTeams, bTeams, aDrivers, bDrivers, allDrivers: DRIVERS, allConstructors: CONSTRUCTORS };
  }, []);

  const usageRollup = useMemo(() => {
    const teams: { [id: string]: number } = {};
    const drivers: { [id: string]: number } = {};

    Object.values(seasonPicks).forEach(p => {
        p.aTeams.forEach(id => { if(id) teams[id] = (teams[id] || 0) + 1; });
        if (p.bTeam) teams[p.bTeam] = (teams[p.bTeam] || 0) + 1;
        p.aDrivers.forEach(id => { if(id) drivers[id] = (drivers[id] || 0) + 1; });
        p.bDrivers.forEach(id => { if(id) drivers[id] = (drivers[id] || 0) + 1; });
    });
    
    return { teams, drivers };
  }, [seasonPicks]);

  const scoreRollup = useMemo(() => {
    let grandPrixPoints = 0;
    let sprintPoints = 0;
    let fastestLapPoints = 0;
    let gpQualifyingPoints = 0;
    let sprintQualifyingPoints = 0;

    const getDriverPoints = (driverId: string | null, results: string[], points: number[]) => {
      if (!driverId) return 0;
      const pos = results.indexOf(driverId);
      return pos !== -1 ? (points[pos] || 0) : 0;
    };
    
    const getTeamPoints = (teamId: string | null, results: string[], points: number[]) => {
      if(!teamId) return 0;
      const teamDrivers = DRIVERS.filter(d => d.constructorId === teamId);
      return teamDrivers.reduce((sum, driver) => sum + getDriverPoints(driver.id, results, points), 0);
    }
    
    Object.entries(seasonPicks).forEach(([eventId, picks]) => {
      const results = MOCK_RACE_RESULTS[eventId];
      if (!results) return; // No results for this event yet

      const allPickedDrivers = [...picks.aDrivers, ...picks.bDrivers].filter(Boolean);
      const allPickedTeams = [...picks.aTeams, picks.bTeam].filter(Boolean);

      // Grand Prix Points (Teams & Drivers)
      allPickedDrivers.forEach(driverId => {
        grandPrixPoints += getDriverPoints(driverId, results.grandPrixFinish, POINTS_SYSTEM.grandPrixFinish);
      });
       allPickedTeams.forEach(teamId => {
        grandPrixPoints += getTeamPoints(teamId, results.grandPrixFinish, POINTS_SYSTEM.grandPrixFinish);
       });

      // Sprint Points (Teams & Drivers)
      if (results.sprintFinish) {
        allPickedDrivers.forEach(driverId => {
          sprintPoints += getDriverPoints(driverId, results.sprintFinish, POINTS_SYSTEM.sprintFinish);
        });
        allPickedTeams.forEach(teamId => {
          sprintPoints += getTeamPoints(teamId, results.sprintFinish, POINTS_SYSTEM.sprintFinish);
        });
      }

      // Fastest Lap
      if (picks.fastestLap === results.fastestLap) {
        fastestLapPoints += POINTS_SYSTEM.fastestLap;
      }

      // GP Qualifying
      allPickedDrivers.forEach(driverId => {
        gpQualifyingPoints += getDriverPoints(driverId, results.gpQualifying, POINTS_SYSTEM.gpQualifying);
      });

      // Sprint Qualifying
      if(results.sprintQualifying) {
         allPickedDrivers.forEach(driverId => {
           sprintQualifyingPoints += getDriverPoints(driverId, results.sprintQualifying, POINTS_SYSTEM.sprintQualifying);
         });
      }
    });

    const totalPoints = grandPrixPoints + sprintPoints + fastestLapPoints + gpQualifyingPoints + sprintQualifyingPoints;

    return { totalPoints, grandPrixPoints, sprintPoints, fastestLapPoints, gpQualifyingPoints, sprintQualifyingPoints };
  }, [seasonPicks]);


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
