import React, { createContext, useContext, ReactNode } from 'react';
import type { ScoredEventIds, SeasonConfig } from '../services/seasonConfig.ts';

const SeasonContext = createContext<SeasonConfig | undefined>(undefined);

export const SeasonProvider: React.FC<{ season: SeasonConfig; children: ReactNode }> = ({ season, children }) => (
  <SeasonContext.Provider value={season}>{children}</SeasonContext.Provider>
);

export const useSeason = (): SeasonConfig => {
  const value = useContext(SeasonContext);
  if (!value) throw new Error('useSeason must be used within a SeasonProvider');
  return value;
};

export const useScoredEventIds = (): ScoredEventIds => useSeason().scoredEventIds;
