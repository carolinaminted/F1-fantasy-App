import React from 'react';
import { SegmentedControl, type Segment } from './SegmentedControl.tsx';
import { useTheme, type ThemeMode } from '../../contexts/ThemeContext.tsx';
import { SunIcon } from '../icons/SunIcon.tsx';
import { MoonIcon } from '../icons/MoonIcon.tsx';
import { SystemThemeIcon } from '../icons/SystemThemeIcon.tsx';

const SEGMENTS: Segment<ThemeMode>[] = [
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'system', label: 'System', icon: SystemThemeIcon, optionLabel: 'Match system' },
];

/** The full three-way appearance choice. Dark leads because it is the default. */
export const ThemeModeControl: React.FC<{ className?: string }> = ({ className }) => {
  const { mode, setMode } = useTheme();
  return (
    <SegmentedControl
      segments={SEGMENTS}
      value={mode}
      onChange={setMode}
      fullWidth
      ariaLabel="Appearance"
      className={className}
    />
  );
};

export default ThemeModeControl;
