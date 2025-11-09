// Fix: Add score calculation logic to process picks against race results and a points system.
import { useMemo, useCallback } from 'react';
import { CONSTRUCTORS, DRIVERS, USAGE_LIMITS } from '../constants';
import { EntityClass, PickSelection, RaceResults } from '../types';
import { calculateUsageRollup, calculateScoreRollup } from '../services/scoringService';

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