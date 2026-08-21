import React from 'react';
import { NUMERIC } from './tokens.ts';

interface MeterProps {
  label?: string;
  value: number;
  max: number;
  /** Raw hex (team color) or a Tailwind bg-* class. Defaults to the brand red. */
  color?: string;
  /** Show "3 left" instead of "7 / 10". */
  showRemaining?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Season usage budget. The point is that burn rate is visible *before* committing a pick,
 * rather than discovered at validation time.
 */
export const Meter: React.FC<MeterProps> = ({
  label, value, max, color, showRemaining, size = 'md', className = '',
}) => {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100));
  const remaining = Math.max(0, max - value);
  const exhausted = remaining === 0;
  const isHex = color?.startsWith('#');

  return (
    <div className={className}>
      {(label || showRemaining !== undefined) && (
        <div className="flex items-baseline justify-between gap-2 mb-1">
          {label && (
            <span className="text-[10px] uppercase tracking-wider text-highlight-silver font-bold truncate">
              {label}
            </span>
          )}
          <span className={`text-[10px] ${NUMERIC} ${exhausted ? 'text-primary-red font-bold' : 'text-highlight-silver'}`}>
            {showRemaining ? `${remaining} left` : `${value} / ${max}`}
          </span>
        </div>
      )}
      <div className={`w-full rounded-full bg-carbon-black/80 overflow-hidden ${size === 'sm' ? 'h-1' : 'h-1.5'}`}>
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            isHex ? '' : exhausted ? 'bg-primary-red' : color ?? 'bg-primary-red'
          }`}
          style={{ width: `${pct}%`, backgroundColor: isHex ? color : undefined }}
        />
      </div>
    </div>
  );
};
