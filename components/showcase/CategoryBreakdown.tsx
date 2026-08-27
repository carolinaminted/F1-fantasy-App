import React from 'react';
import { CATEGORY_THEME, NUMERIC } from '../ui/index.ts';
import { CATEGORY_KEYS, SHORT_LABEL, categoryOf, pointsOf, type ProcessedUser } from './utils.ts';

/**
 * How a score was actually built, in the four category colors.
 *
 * The old dashboard hid this behind a "4 Category Breakdown — Show ▼" toggle in eight
 * separate places, each with its own copy of the markup. It is the most interesting thing
 * on any of those cards, so here it is always visible and defined once.
 */

interface BarProps {
  user: ProcessedUser;
  className?: string;
  height?: 'sm' | 'md';
}

/** Proportional stacked bar — the shape of a season at a glance. */
export const CategoryBar: React.FC<BarProps> = ({ user, className = '', height = 'sm' }) => {
  const total = CATEGORY_KEYS.reduce((n, k) => n + Math.max(0, categoryOf(user, k)), 0);

  return (
    <div
      className={`w-full flex rounded-full overflow-hidden bg-carbon-black/80 ${
        height === 'sm' ? 'h-1.5' : 'h-2.5'
      } ${className}`}
      role="img"
      aria-label={CATEGORY_KEYS
        .map(k => `${CATEGORY_THEME[k].label} ${categoryOf(user, k)}`)
        .join(', ')}
    >
      {total > 0 &&
        CATEGORY_KEYS.map(k => {
          const share = (Math.max(0, categoryOf(user, k)) / total) * 100;
          if (share <= 0) return null;
          return (
            <div
              key={k}
              className={CATEGORY_THEME[k].bg}
              style={{ width: `${share}%` }}
            />
          );
        })}
    </div>
  );
};

interface StripProps {
  user: ProcessedUser;
  /** Spell out "Grand Prix" instead of "GP". Only fits in the wider layouts. */
  longLabels?: boolean;
  className?: string;
}

/** The four figures themselves, each in its category color. */
export const CategoryStrip: React.FC<StripProps> = ({ user, longLabels, className = '' }) => (
  <div className={`grid grid-cols-4 gap-1.5 ${className}`}>
    {CATEGORY_KEYS.map(k => {
      const theme = CATEGORY_THEME[k];
      return (
        <div
          key={k}
          className={`rounded-lg border ${theme.border}/25 bg-carbon-black/60 px-1.5 py-1 text-center`}
        >
          <span className={`block text-[9px] font-bold uppercase tracking-wider ${theme.text} opacity-90 truncate`}>
            {longLabels ? theme.label : SHORT_LABEL[k]}
          </span>
          <span className={`block text-sm font-black ${NUMERIC} text-pure-white`}>
            {categoryOf(user, k)}
          </span>
        </div>
      );
    })}
  </div>
);
