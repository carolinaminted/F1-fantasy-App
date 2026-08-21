import React from 'react';
import { Meter } from '../ui/Meter.tsx';
import { withAlpha, NUMERIC } from '../ui/tokens.ts';

interface SlotCardProps {
  /** Display name of the selected entity, or null for an empty slot. */
  name?: string | null;
  /** Constructor name under a driver, or class under a team. */
  subtitle?: string | null;
  /** Team brand color. Drives the whole filled treatment. */
  color?: string;
  placeholder: string;
  used?: number;
  limit?: number;
  onClick?: () => void;
  onClear?: () => void;
  disabled?: boolean;
  /** Read-only lineups (locked, past, cancelled) render the same card without affordances. */
  readOnly?: boolean;
}

/**
 * One pick slot. Filled slots are a solid, team-colored card rather than a dropdown value,
 * so a completed lineup reads as a board at a glance.
 */
export const SlotCard: React.FC<SlotCardProps> = ({
  name, subtitle, color, placeholder, used, limit, onClick, onClear, disabled, readOnly,
}) => {
  const filled = !!name;
  const interactive = !disabled && !readOnly;

  const style: React.CSSProperties = filled && color
    ? {
        borderColor: withAlpha(color, 0.65),
        backgroundColor: withAlpha(color, 0.14),
        boxShadow: `inset 3px 0 0 0 ${color}`,
      }
    : {};

  return (
    <div className="relative group">
      <button
        type="button"
        onClick={interactive ? onClick : undefined}
        disabled={!interactive}
        style={style}
        className={[
          'w-full min-h-[4.5rem] rounded-xl border px-3 py-2.5 text-left transition-all duration-200',
          filled
            ? 'border-pure-white/15'
            : 'border-dashed border-pure-white/20 bg-carbon-black/40',
          interactive ? 'cursor-pointer hover:border-pure-white/40 active:scale-[0.99]' : 'cursor-default',
          disabled && !readOnly ? 'opacity-50' : '',
        ].filter(Boolean).join(' ')}
      >
        {filled ? (
          <>
            <div className="font-bold text-sm md:text-base text-pure-white leading-tight pr-5">{name}</div>
            {subtitle && (
              <div className="text-[10px] uppercase tracking-wider text-highlight-silver/90 mt-0.5 truncate">
                {subtitle}
              </div>
            )}
            {used !== undefined && limit !== undefined && (
              <>
                {/* Same budget read-out as the option sheet, so a pick looks the same
                    before and after it lands in a slot. */}
                <Meter value={used} max={limit} color={color} size="sm" className="mt-2" />
                <div className={`text-[10px] mt-1 text-highlight-silver/70 ${NUMERIC}`}>
                  {used} / {limit} used
                </div>
              </>
            )}
          </>
        ) : (
          <div className="h-full min-h-[3rem] flex items-center justify-center">
            <span className="text-sm font-bold uppercase tracking-wider text-highlight-silver/60">
              {placeholder}
            </span>
          </div>
        )}
      </button>

      {filled && interactive && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${name}`}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-highlight-silver/70 hover:text-pure-white hover:bg-pure-white/15 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};
