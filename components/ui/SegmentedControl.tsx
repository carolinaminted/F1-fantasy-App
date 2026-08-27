import React from 'react';
import { ChevronDownIcon } from '../icons/ChevronDownIcon.tsx';

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  count?: number;
  /**
   * Text for the dropdown option, when it should differ from the segment label. Insights
   * shows "Race" on the bar but "Sunday Specialists" in the picker — the bar is tight, the
   * picker is not.
   */
  optionLabel?: string;
}

interface SegmentSelectProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Required — the select has no visible label of its own. */
  ariaLabel: string;
  className?: string;
}

/**
 * The phone form of a segment row: the OS picker.
 *
 * Past about four segments the bar is wider than the screen, and a sideways-scrolling row
 * hides its own options — you cannot tell there is more without dragging it. A native select
 * shows the current choice and reveals the rest on tap.
 *
 * Exported on its own for callers that place the bar and the picker in different parts of
 * the layout; callers that just want one or the other by breakpoint want `collapseOnMobile`.
 */
export function SegmentSelect<T extends string>({
  segments, value, onChange, ariaLabel, className = '',
}: SegmentSelectProps<T>) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        aria-label={ariaLabel}
        className="w-full appearance-none cursor-pointer rounded-lg border border-accent-gray bg-carbon-black py-2 pl-4 pr-9 text-center text-sm font-bold uppercase tracking-wider text-pure-white focus:border-primary-red focus:outline-none"
      >
        {segments.map(seg => (
          <option key={seg.value} value={seg.value}>{seg.optionLabel ?? seg.label}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-highlight-silver">
        <ChevronDownIcon className="h-4 w-4" />
      </div>
    </div>
  );
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  /**
   * Let the bar scroll sideways instead of squeezing labels when there are more segments
   * than fit a phone. Needed anywhere past about four.
   */
  scrollable?: boolean;
  /**
   * Below `md`, render the OS picker instead of the bar. Opt-in: most segment rows are short
   * enough to fit a phone, and only the ones that aren't should change shape.
   */
  collapseOnMobile?: boolean;
  /** Label for the collapsed select. Required when `collapseOnMobile` is set. */
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  segments, value, onChange, size = 'md', fullWidth, scrollable, collapseOnMobile,
  ariaLabel, className = '',
}: SegmentedControlProps<T>) {
  const bar = (
    <div
      role="tablist"
      className={[
        'inline-flex items-center gap-1 rounded-xl border border-pure-white/10 bg-carbon-black/60 p-1',
        fullWidth ? 'w-full' : '',
        scrollable ? 'shrink-0' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {segments.map(seg => {
        const active = seg.value === value;
        const Icon = seg.icon;
        return (
          <button
            key={seg.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(seg.value)}
            className={[
              'flex items-center justify-center gap-1.5 rounded-lg font-bold uppercase tracking-wider transition-colors duration-150',
              size === 'sm' ? 'text-[10px] px-2.5 py-1.5' : 'text-xs px-3.5 py-2',
              fullWidth ? 'flex-1' : '',
              active
                ? 'bg-primary-red text-pure-white'
                : 'text-highlight-silver hover:text-pure-white hover:bg-pure-white/5',
            ].filter(Boolean).join(' ')}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {seg.label}
            {seg.count !== undefined && (
              <span className={`ml-0.5 font-mono tabular-nums ${active ? 'opacity-80' : 'opacity-60'}`}>
                ({seg.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const scroller = scrollable
    ? (
      <div className="w-full overflow-x-auto no-scrollbar flex justify-start md:justify-center">
        {bar}
      </div>
    )
    : bar;

  if (!collapseOnMobile) return scroller;

  return (
    <>
      <SegmentSelect
        segments={segments}
        value={value}
        onChange={onChange}
        ariaLabel={ariaLabel ?? 'Select a view'}
        className="md:hidden"
      />
      <div className="hidden md:block">{scroller}</div>
    </>
  );
}
