import React from 'react';
import { Tile } from './Tile.tsx';
import { NUMERIC, CATEGORY_THEME, type Category } from './tokens.ts';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  unit?: string;
  /** Signed change vs. a previous period, e.g. +17 or -3. Sign drives the color. */
  delta?: number;
  deltaLabel?: string;
  /** Points-per-event history; rendered as a bare sparkline. */
  sparkline?: number[];
  /** Sits to the right of the value, smaller — e.g. the points behind a rank. */
  secondary?: React.ReactNode;
  accent?: Category;
  /**
   * Carry the accent onto the tile's border, the way the Dashboard's category tiles do.
   * Off by default: plenty of stat tiles use an accent purely to tint their number.
   */
  accentEdge?: boolean;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  className?: string;
}

const Sparkline: React.FC<{ points: number[]; className?: string }> = ({ points, className = '' }) => {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 100 - ((p - min) / span) * 100;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
         className={`w-full h-8 overflow-visible ${className}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="3"
            vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const StatTile: React.FC<StatTileProps> = ({
  label, value, unit, secondary, delta, deltaLabel, sparkline, accent, accentEdge, icon: Icon, className = '',
}) => {
  const theme = accent ? CATEGORY_THEME[accent] : undefined;
  const deltaTone = delta === undefined || delta === 0
    ? 'text-highlight-silver'
    : delta > 0 ? 'text-green-400' : 'text-primary-red';

  return (
    <Tile className={className} padding="md" accent={accentEdge ? accent : undefined} accentEdge={accentEdge}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] text-highlight-silver uppercase tracking-wider font-bold">
          {label}
        </span>
        {Icon && <Icon className={`w-4 h-4 shrink-0 ${theme?.text ?? 'text-highlight-silver'}`} />}
      </div>

      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`text-3xl md:text-4xl font-black leading-none ${NUMERIC} ${theme?.text ?? 'text-pure-white'}`}>
          {value}
        </span>
        {unit && <span className="text-[11px] text-highlight-silver uppercase tracking-wider">{unit}</span>}
        {secondary && <span className={`text-[11px] ${NUMERIC} text-highlight-silver`}>{secondary}</span>}
      </div>

      {(delta !== undefined || deltaLabel) && (
        <div className={`mt-1.5 text-xs font-bold ${NUMERIC} ${deltaTone}`}>
          {delta !== undefined && <>{delta > 0 ? '+' : ''}{delta}</>}
          {deltaLabel && <span className="ml-1 font-medium opacity-80">{deltaLabel}</span>}
        </div>
      )}

      {sparkline && sparkline.length > 1 && (
        <div className={`mt-3 ${theme?.text ?? 'text-primary-red'} opacity-70`}>
          <Sparkline points={sparkline} />
        </div>
      )}
    </Tile>
  );
};
