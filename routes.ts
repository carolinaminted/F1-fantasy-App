import type { Page } from './App.tsx';

/**
 * URL <-> Page mapping.
 *
 * Gate 2 gave every surface a URL; Gate 5 merged three of them into Race. `picks`,
 * `schedule`, and `gp-results` remain in the `Page` union so the eleven components that
 * navigate by page name did not have to change — they now all resolve to /race with the
 * matching view.
 */
export const PAGE_PATHS: Record<Page, string> = {
  'home': '/',
  'race': '/race',
  'picks': '/race',            // retired destination, folded into Race
  'leaderboard': '/standings',
  'profile': '/profile',
  'admin': '/admin',
  'points': '/points',
  'donate': '/donate',
  'support': '/support',
  'gp-results': '/race',       // retired: was SchedulePage with a flag
  'duesPayment': '/dues',
  'drivers-teams': '/drivers-teams',
  'schedule': '/race',         // retired, folded into Race
  'league-hub': '/league',
};

/**
 * Reverse lookup. Retired destinations share a path with the surface that absorbed them,
 * so this table is built from the canonical entries only.
 */
const CANONICAL: Page[] = [
  'home', 'race', 'leaderboard', 'profile', 'admin', 'points', 'donate',
  'support', 'duesPayment', 'drivers-teams', 'league-hub',
];

const PATH_PAGES = CANONICAL.reduce<Record<string, Page>>(
  (acc, page) => { acc[PAGE_PATHS[page]] = page; return acc; },
  {}
);

/**
 * Paths retired by the IA merge, and where they now live. Anyone with an old link or an
 * open tab lands in the right place instead of on a dead route.
 */
export const REDIRECTS: Record<string, string> = {
  '/picks': '/race?view=picks',
  '/schedule': '/race?view=weekend',
  '/gp-results': '/race?view=results',
  '/leaderboard': '/standings',
};

/** Retired destinations map to a view of the Race surface. */
const RACE_VIEW_FOR_PAGE: Partial<Record<Page, string>> = {
  'picks': 'picks',
  'schedule': 'weekend',
  'gp-results': 'results',
  'race': 'picks',
};

export const pathForPage = (page: Page): string => {
  const base = PAGE_PATHS[page] ?? '/';
  const view = RACE_VIEW_FOR_PAGE[page];
  return view ? `${base}?view=${view}` : base;
};

/** Unknown paths fall back to home, matching the old switch's `default` branch. */
export const pageForPath = (pathname: string): Page => {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PATH_PAGES[normalized] ?? 'home';
};

/** Admin-only primitive gallery. Deliberately outside the Page union — it is not a surface. */
export const DEV_UI_PATH = '/dev/ui';
