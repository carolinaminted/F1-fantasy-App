import { useMemo, useCallback } from 'react';
import { USAGE_LIMITS, CONSTRUCTORS } from '../constants.ts';
import { EntityClass, PickSelection, RaceResults, PointsSystem, Driver, Constructor } from '../types.ts';
import { calculateUsageRollup, calculateScoreRollup } from '../services/scoringService.ts';

const useFantasyData = (
    seasonPicks: { [eventId: string]: PickSelection },
    raceResults: RaceResults,
    pointsSystem: PointsSystem,
    allDrivers: Driver[],
    allConstructors: Constructor[]
) => {
  const data = useMemo(() => {
    // Only show Active entities in selection forms
    const activeConstructors = allConstructors.filter(c => c.isActive);
    
    // Sort logic: Order by index in the STATIC CONSTANT (2025 Standings) to ensure correct rank
    // irrespective of database load order.
    const getTeamRank = (id: string) => {
        const index = CONSTRUCTORS.findIndex(c => c.id === id);
        return index === -1 ? 999 : index; // Put unknown/new teams at the end
    };

    // Sort Teams
    const sortedConstructors = [...activeConstructors].sort((a, b) => {
        return getTeamRank(a.id) - getTeamRank(b.id);
    });

    // Sort Drivers (By Team Rank, then Alphabetical)
    const sortedDrivers = [...allDrivers].sort((a, b) => {
        const rankA = getTeamRank(a.constructorId);
        const rankB = getTeamRank(b.constructorId);
        
        if (rankA !== rankB) {
            return rankA - rankB;
        }
        return a.name.localeCompare(b.name);
    });

    const activeDrivers = sortedDrivers.filter(d => d.isActive);

    const aTeams = sortedConstructors.filter(c => c.class === EntityClass.A);
    const bTeams = sortedConstructors.filter(c => c.class === EntityClass.B);
    const aDrivers = activeDrivers.filter(d => d.class === EntityClass.A);
    const bDrivers = activeDrivers.filter(d => d.class === EntityClass.B);
    
    return { aTeams, bTeams, aDrivers, bDrivers };
  }, [allDrivers, allConstructors]);

  const usageRollup = useMemo(() => calculateUsageRollup(seasonPicks), [seasonPicks]);
  const scoreRollup = useMemo(() => calculateScoreRollup(seasonPicks, raceResults, pointsSystem, allDrivers), [seasonPicks, raceResults, pointsSystem, allDrivers]);

  const getUsage = useCallback((id: string, type: 'teams' | 'drivers'): number => {
    return usageRollup[type][id] || 0;
  }, [usageRollup]);

  const getLimit = useCallback((entityClass: EntityClass, type: 'teams' | 'drivers'): number => {
    return USAGE_LIMITS[entityClass][type];
  }, []);

  const hasRemaining = useCallback((id: string, type: 'teams' | 'drivers'): boolean => {
    const entityList = type === 'teams' ? allConstructors : allDrivers;
    const entity = entityList.find(e => e.id === id);
    if (!entity) return false;

    const usage = getUsage(id, type);
    const limit = getLimit(entity.class, type);
    return usage < limit;
  }, [getLimit, getUsage, allDrivers, allConstructors]);

  return { ...data, getUsage, getLimit, hasRemaining, usageRollup, scoreRollup, allDrivers, allConstructors };
};

export default useFantasyData;