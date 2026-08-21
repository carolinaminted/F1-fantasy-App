import React from 'react';

export interface Segment<T extends string> {
  value: T;
  label: string;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  segments, value, onChange, size = 'md', fullWidth, className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={[
        'inline-flex items-center gap-1 rounded-xl border border-pure-white/10 bg-carbon-black/60 p-1',
        fullWidth ? 'w-full' : '',
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
}
