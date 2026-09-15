import React from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { SunIcon } from '../icons/SunIcon.tsx';
import { MoonIcon } from '../icons/MoonIcon.tsx';

/**
 * Persistent light/dark switch for the desktop rail.
 *
 * A sliding thumb rather than a menu item, so the current theme is readable at a glance
 * without opening anything. The track follows the app's tile recipe — hairline border over
 * a translucent fill with a blur behind it — and the thumb is a lighter pane of the same
 * material, which is what gives it the glass feel. Both are built from the ink token, so
 * the whole control inverts with the theme it controls.
 */
export const ThemeSwitch: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className={[
        'group relative flex w-full items-center rounded-full p-1',
        'border border-pure-white/10 bg-accent-gray/40 backdrop-blur-sm',
        'transition-colors duration-200 hover:border-pure-white/25',
        className,
      ].filter(Boolean).join(' ')}
    >
      {/* The pane that slides. Inset by the track's padding on every side. */}
      <span
        aria-hidden="true"
        className={[
          'pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full',
          'border border-pure-white/15 bg-pure-white/10 backdrop-blur-md',
          'shadow-[0_2px_10px_-2px_rgba(0,0,0,0.5)]',
          'transition-transform duration-300 ease-out will-change-transform',
          isDark ? 'translate-x-full' : 'translate-x-0',
        ].join(' ')}
      />

      <span
        className={`relative z-10 flex flex-1 items-center justify-center py-1.5 transition-colors duration-200 ${
          isDark ? 'text-highlight-silver' : 'text-pure-white'
        }`}
      >
        <SunIcon className="h-4 w-4" />
      </span>
      <span
        className={`relative z-10 flex flex-1 items-center justify-center py-1.5 transition-colors duration-200 ${
          isDark ? 'text-pure-white' : 'text-highlight-silver'
        }`}
      >
        <MoonIcon className="h-4 w-4" />
      </span>
    </button>
  );
};

export default ThemeSwitch;
