import React from 'react';
import { useTheme } from '../../contexts/ThemeContext.tsx';
import { SunIcon } from '../icons/SunIcon.tsx';
import { MoonIcon } from '../icons/MoonIcon.tsx';

/**
 * Light/dark flip shaped as a dropdown row, for the desktop SideNav menu. Same behaviour as
 * ThemeToggle — it names the theme you would get by pressing it. Class list matches the
 * sibling menu items in App.tsx so the menu stays one thing.
 */
export const ThemeMenuItem: React.FC<{ onSelect?: () => void }> = ({ onSelect }) => {
  const { theme, toggle } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  const Icon = next === 'light' ? SunIcon : MoonIcon;

  return (
    <button
      type="button"
      onClick={() => { toggle(); onSelect?.(); }}
      className="w-full text-left px-4 py-3 text-sm font-semibold text-pure-white hover:bg-pure-white/10 rounded-lg flex items-center gap-3 transition-colors"
    >
      <Icon className="w-4 h-4 text-highlight-silver" />
      {next === 'light' ? 'Light mode' : 'Dark mode'}
    </button>
  );
};

export default ThemeMenuItem;
