
// Fix: Add score calculation logic to process picks against race results and a points system.
import { useMemo, useCallback } from 'react';
import { USAGE_LIMITS } from '../constants.ts';
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
    const activeDrivers = allDrivers.filter(d => d.isActive);

    const aTeams = activeConstructors.filter(c => c.class === EntityClass.A);
    const bTeams = activeConstructors.filter(c => c.class === EntityClass.B);
    const aDrivers = activeDrivers.filter(d => d.class === EntityClass.A);
    const bDrivers = activeDrivers.filter(d => d.class === EntityClass.B);
    return { aTeams, bTeams, aDrivers, bDrivers };
  }, [allDrivers, allConstructors]);

  const usageRollup = useMemo(() => calculateUsageRollup(seasonPicks), [seasonPicks]);
  // Pass allDrivers to scoring service so it can resolve constructor IDs correctly
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
