import React from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { SunIcon } from '../icons/SunIcon.tsx';
import { MoonIcon } from '../icons/MoonIcon.tsx';

interface ThemeToggleProps {
  className?: string;
  iconClassName?: string;
}

/**
 * One-tap light/dark flip for the app chrome. The three-way choice, including "follow the
 * system", lives in Appearance on the profile page — this is the shortcut, so it shows the
 * theme you would get by pressing it, not the one you are in.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', iconClassName = 'w-6 h-6' }) => {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = next === 'light' ? SunIcon : MoonIcon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`transition-colors text-highlight-silver hover:text-primary-red ${className}`}
    >
      <Icon className={iconClassName} />
    </button>
  );
};

export default ThemeToggle;
