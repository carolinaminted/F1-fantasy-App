import React from 'react';
import { TONE_THEME, withAlpha, type Tone } from './tokens.ts';

interface ChipProps {
  label: React.ReactNode;
  /** Team hex. Takes precedence over `tone` — team colors always win on team-linked elements. */
  color?: string;
  tone?: Tone;
  size?: 'xs' | 'sm';
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
  className?: string;
}

export const Chip: React.FC<ChipProps> = ({
  label, color, tone = 'neutral', size = 'sm', icon: Icon, className = '',
}) => {
  const t = TONE_THEME[tone];
  const style: React.CSSProperties = color
    ? { color, borderColor: withAlpha(color, 0.5), backgroundColor: withAlpha(color, 0.12) }
    : {};

  return (
    <span
      style={style}
      className={[
        'inline-flex items-center gap-1 rounded-md border font-bold uppercase tracking-wider whitespace-nowrap',
        size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1',
        color ? '' : `${t.text} ${t.border} ${t.bg}`,
        className,
      ].filter(Boolean).join(' ')}
    >
      {Icon && <Icon className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
      {label}
    </span>
  );
};
