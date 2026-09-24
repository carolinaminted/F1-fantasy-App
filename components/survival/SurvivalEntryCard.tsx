import React from 'react';
import { Tile, Chip } from '../ui/index.ts';
import { SurvivalIcon } from '../icons/SurvivalIcon.tsx';
import { useSurvival } from '../../hooks/useSurvival.ts';

interface Props {
  onOpen: () => void;
  /** Race only advertises a running challenge; League always shows the way in. */
  hideWhenInactive?: boolean;
}

export const SurvivalEntryCard: React.FC<Props> = ({ onOpen, hideWhenInactive }) => {
  const { config, standings } = useSurvival(false);
  const running = config?.status === 'active';
  if (hideWhenInactive && !running) return null;
  const status = !running ? 'Not running' : standings?.status === 'complete' ? 'Finished' : 'Live';
  return (
    <Tile padding="md" onClick={onOpen} className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-3 min-w-0">
        <SurvivalIcon className="h-6 w-6 flex-none text-primary-red" />
        <span className="min-w-0">
          <span className="block text-sm font-black uppercase italic tracking-wide text-pure-white">Podium Survival</span>
          <span className="block truncate text-xs text-highlight-silver">One driver a race. Podium or out.</span>
        </span>
      </span>
      <Chip label={status} tone={status === 'Live' ? 'success' : 'neutral'} size="xs" />
    </Tile>
  );
};
