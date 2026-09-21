import { useMemo, useCallback } from 'react';
import { USAGE_LIMITS, CONSTRUCTORS } from '../constants.ts';
import { EntityClass, PickSelection, RaceResults, PointsSystem, Driver, Constructor } from '../types.ts';
import { calculateUsageRollup, calculateScoreRollup } from '../services/scoringService.ts';

const useFantasyData = (
    seasonPicks: { [eventId: string]: PickSelection },
    raceResults: RaceResults,
    pointsSystem: PointsSystem,
    allDrivers: Driver[],
    allConstructors: Constructor[],
    cancelledEventIds: Set<string> = new Set()
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

  const usageRollup = useMemo(() => calculateUsageRollup(seasonPicks, cancelledEventIds), [seasonPicks, cancelledEventIds]);
  const scoreRollup = useMemo(() => calculateScoreRollup(seasonPicks, raceResults, pointsSystem, allDrivers, cancelledEventIds), [seasonPicks, raceResults, pointsSystem, allDrivers, cancelledEventIds]);

  // Budgets are per (entity, class), so every reader has to say which class it is spending.
  // Callers pass the class of the *slot* being filled, not the entity's current class — for a
  // pick stored before a class change those differ, and the slot is the one that spent the budget.
  const getUsage = useCallback((id: string, type: 'teams' | 'drivers', entityClass: EntityClass): number => {
    return usageRollup[type][id]?.[entityClass] ?? 0;
  }, [usageRollup]);

  const getLimit = useCallback((entityClass: EntityClass, type: 'teams' | 'drivers'): number => {
    return USAGE_LIMITS[entityClass][type];
  }, []);

  const hasRemaining = useCallback((id: string, type: 'teams' | 'drivers', entityClass: EntityClass): boolean => {
    return getUsage(id, type, entityClass) < getLimit(entityClass, type);
  }, [getLimit, getUsage]);

  /**
   * One class's bucket flattened to `{ id: count }`, so presentational components that show a
   * single class's meters keep taking a plain map and stay class-unaware.
   */
  const getUsageMap = useCallback((type: 'teams' | 'drivers', entityClass: EntityClass): { [id: string]: number } => {
    const out: { [id: string]: number } = {};
    Object.entries(usageRollup[type]).forEach(([id, usage]) => {
      if (usage[entityClass] > 0) out[id] = usage[entityClass];
    });
    return out;
  }, [usageRollup]);

  return { ...data, getUsage, getLimit, hasRemaining, getUsageMap, usageRollup, scoreRollup, allDrivers, allConstructors };
};

export default useFantasyData;