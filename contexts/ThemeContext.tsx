import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, ReactNode } from 'react';

/**
 * Theme state. The actual repaint is done entirely in CSS — `styles/theme.css` redefines
 * the brand tokens under `:root[data-theme="light"]`, and every `bg-carbon-black` /
 * `text-pure-white` utility follows because Tailwind v4 compiles them to var() references.
 * All this module does is decide which value `data-theme` carries.
 */
export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/**
 * Duplicated, deliberately, by the pre-paint script in index.html. That script cannot
 * import from a module — it has to run before the bundle loads or the app paints dark
 * for a beat before flipping. If this key changes, change it there too.
 */
export const THEME_STORAGE_KEY = 'lol_theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * An absent preference resolves to 'dark', NOT 'system'. The league has ~40 existing
 * members who have only ever seen the dark app; defaulting to 'system' would hand a
 * white app to everyone whose phone is in light mode without them asking for it.
 * Following the OS is opt-in.
 */
export const DEFAULT_MODE: ThemeMode = 'dark';

const isMode = (value: unknown): value is ThemeMode =>
  value === 'system' || value === 'light' || value === 'dark';

/** Storage throws in private mode and when site data is blocked — never let that break boot. */
export const readStoredMode = (): ThemeMode => {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isMode(raw) ? raw : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
};

const writeStoredMode = (mode: ThemeMode): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* Preference is lost on reload; the session still honours it. */
  }
};

const systemTheme = (): ResolvedTheme =>
  window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';

export const resolveTheme = (mode: ThemeMode): ResolvedTheme =>
  mode === 'system' ? systemTheme() : mode;

const applyTheme = (theme: ResolvedTheme): void => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Makes native scrollbars, form controls and the caret follow the theme.
  root.style.colorScheme = theme;
};

interface ThemeContextType {
  /** What the user chose. */
  mode: ThemeMode;
  /** What that currently renders as — 'system' collapses to one of these. */
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** Light <-> dark, for the one-tap header button. From 'system', flips away from whatever the OS is doing. */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredMode()));

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    writeStoredMode(next);
    setTheme(resolveTheme(next));
  }, []);

  const toggle = useCallback(() => {
    setModeState((current) => {
      const next: ThemeMode = resolveTheme(current) === 'dark' ? 'light' : 'dark';
      writeStoredMode(next);
      setTheme(next);
      return next;
    });
  }, []);

  // Paint. The pre-paint script in index.html has usually done this already; this keeps
  // the DOM correct after any state change and is idempotent under StrictMode.
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Only while following the OS: track live appearance changes without a reload.
  useEffect(() => {
    if (mode !== 'system') return;
    const query = window.matchMedia(DARK_QUERY);
    const onChange = () => setTheme(query.matches ? 'dark' : 'light');
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mode]);

  const value = useMemo(() => ({ mode, theme, setMode, toggle }), [mode, theme, setMode, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
