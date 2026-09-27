import React, { createContext, useContext, ReactNode } from 'react';
import type { ScoredEventIds } from '../services/seasonConfig.ts';

const SeasonContext = createContext<ScoredEventIds | undefined>(undefined);

export const SeasonProvider: React.FC<{ scoredEventIds: ScoredEventIds; children: ReactNode }> = ({ scoredEventIds, children }) => (
  <SeasonContext.Provider value={scoredEventIds}>{children}</SeasonContext.Provider>
);

export const useScoredEventIds = (): ScoredEventIds => {
  const value = useContext(SeasonContext);
  if (!value) throw new Error('useScoredEventIds must be used within a SeasonProvider');
  return value;
};
