
import { useMemo } from 'react';
import { CONSTRUCTORS, DRIVERS, USAGE_LIMITS, MOCK_USER_USAGE } from '../constants';
import { EntityClass } from '../types';

const useFantasyData = () => {
  const data = useMemo(() => {
    const aTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.A);
    const bTeams = CONSTRUCTORS.filter(c => c.class === EntityClass.B);
    const aDrivers = DRIVERS.filter(d => d.class === EntityClass.A);
    const bDrivers = DRIVERS.filter(d => d.class === EntityClass.B);
    return { aTeams, bTeams, aDrivers, bDrivers, allDrivers: DRIVERS };
  }, []);

  const getUsage = (id: string, type: 'teams' | 'drivers'): number => {
    return MOCK_USER_USAGE[type][id] || 0;
  };

  const getLimit = (entityClass: EntityClass, type: 'teams' | 'drivers'): number => {
    return USAGE_LIMITS[entityClass][type];
  };

  const hasRemaining = (id: string, type: 'teams' | 'drivers'): boolean => {
    const entityList = type === 'teams' ? CONSTRUCTORS : DRIVERS;
    const entity = entityList.find(e => e.id === id);
    if (!entity) return false;

    const usage = getUsage(id, type);
    const limit = getLimit(entity.class, type);
    return usage < limit;
  };

  return { ...data, getUsage, getLimit, hasRemaining };
};

export default useFantasyData;
