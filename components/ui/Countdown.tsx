import React, { useState, useEffect, useCallback } from 'react';
import { LockIcon } from '../icons/LockIcon.tsx';
import { parseLeagueDate } from '../../utils/dateUtils.ts';
import { NUMERIC } from './tokens.ts';

interface CountdownProps {
  /** League-format date string, parsed with the app's existing parseLeagueDate. */
  targetDate: string;
  onExpire?: () => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  expiredLabel?: string;
  className?: string;
}

const SIZE = {
  sm: { value: 'text-lg', unit: 'text-[8px]', gap: 'gap-1.5' },
  md: { value: 'text-xl md:text-2xl', unit: 'text-[9px]', gap: 'gap-2' },
  lg: { value: 'text-3xl md:text-4xl', unit: 'text-[10px]', gap: 'gap-3' },
} as const;

/**
 * Consolidates CountdownTimer. Same thresholds as the original: red inside an hour,
 * red + pulse inside five minutes.
 */
export const Countdown: React.FC<CountdownProps> = ({
  targetDate, onExpire, label, size = 'md', expiredLabel = 'Picks Locked', className = '',
}) => {
  const compute = useCallback(() => {
    if (!targetDate) return { difference: undefined as number | undefined, d: 0, h: 0, m: 0, s: 0 };
    const target = parseLeagueDate(targetDate);
    if (!target) return { difference: undefined as number | undefined, d: 0, h: 0, m: 0, s: 0 };
    const difference = target.getTime() - Date.now();
    return {
      difference,
      d: Math.max(0, Math.floor(difference / (1000 * 60 * 60 * 24))),
      h: Math.max(0, Math.floor((difference / (1000 * 60 * 60)) % 24)),
      m: Math.max(0, Math.floor((difference / 1000 / 60) % 60)),
      s: Math.max(0, Math.floor((difference / 1000) % 60)),
    };
  }, [targetDate]);

  const [state, setState] = useState(compute);
  const [expired, setExpired] = useState(() => {
    const { difference } = compute();
    return difference !== undefined && difference <= 0;
  });

  useEffect(() => {
    const { difference } = compute();
    if (difference !== undefined && difference <= 0) { setExpired(true); return; }
    const timer = setInterval(() => {
      const next = compute();
      setState(next);
      if (next.difference !== undefined && next.difference <= 0) {
        setExpired(true);
        clearInterval(timer);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [compute, onExpire]);

  if (!targetDate) return null;

  if (expired) {
    return (
      <div className={`flex items-center gap-2 text-primary-red font-bold ${className}`}>
        <LockIcon className="w-5 h-5" />
        <span className="uppercase tracking-widest text-sm">{expiredLabel}</span>
      </div>
    );
  }

  const { difference } = state;
  if (!difference) return null;

  const urgent = difference < 5 * 60 * 1000;
  const warning = difference < 60 * 60 * 1000;
  const color = warning ? 'text-primary-red' : 'text-ghost-white';
  const pulse = urgent ? 'animate-pulse-red' : warning ? 'animate-pulse' : '';
  const s = SIZE[size];

  const units: Array<[number, string]> = [[state.d, 'Days'], [state.h, 'Hrs'], [state.m, 'Min'], [state.s, 'Sec']];

  return (
    <div className={className}>
      {label && (
        <div className="text-[10px] uppercase tracking-widest text-highlight-silver font-bold mb-1 text-center">
          {label}
        </div>
      )}
      <div className={`flex items-center justify-center ${s.gap} ${NUMERIC} ${pulse}`}>
        {units.map(([value, unit], i) => (
          <React.Fragment key={unit}>
            {i > 0 && <span className={`${s.value} mb-3 ${color} opacity-60`}>:</span>}
            <div className="flex flex-col items-center">
              <span className={`${s.value} font-bold leading-none ${color}`}>
                {value.toString().padStart(2, '0')}
              </span>
              <span className={`${s.unit} text-highlight-silver uppercase tracking-wider mt-0.5`}>{unit}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
