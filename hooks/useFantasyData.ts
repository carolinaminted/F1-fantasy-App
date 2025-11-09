import { useMemo, useCallback } from 'react';
import { CONSTRUCTORS, DRIVERS, USAGE_LIMITS } from '../constants';
import { EntityClass, PickSelection } from '../types';

const useFantasyData = (seasonPicks: { [eventId: string]: PickSelection }) => {
  const data = useMemo(() => {
    const aTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.A);
    const bTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.B);
    const aDrivers = DRIVERS.filter(d => d.class === EntityClass.A);
    const bDrivers = DRIVERS.filter(d => d.class === EntityClass.B);
    return { aTeams, bTeams, aDrivers, bDrivers, allDrivers: DRIVERS };
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

  return { ...data, getUsage, getLimit, hasRemaining, usageRollup };
};

export default useFantasyData;