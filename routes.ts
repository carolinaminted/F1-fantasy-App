import type { Page } from './App.tsx';

/**
 * URL <-> Page mapping.
 *
 * Gate 2 gave every surface a URL; Gate 5 merged three of them into Race and Gate 11
 * merged four more into League. Gate 13 pruned the union down to the six canonical
 * surfaces plus three aliases that components still navigate by — each alias resolves to
 * the surface that absorbed it, with the matching view or query. Old *URLs* are covered
 * separately by REDIRECTS below.
 */
export const PAGE_PATHS: Record<Page, string> = {
  'home': '/',
  'race': '/race',
  'picks': '/race',            // alias: Race with the picks view
  'leaderboard': '/standings',
  'profile': '/profile',
  'admin': '/admin',
  'gp-results': '/race',       // alias: Race with the results view
  'duesPayment': '/league',    // alias: League with the dues sheet open
  'league-hub': '/league',
};

/**
 * Reverse lookup. Retired destinations share a path with the surface that absorbed them,
 * so this table is built from the canonical entries only.
 */
const CANONICAL: Page[] = [
  'home', 'race', 'leaderboard', 'profile', 'admin', 'league-hub',
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
  '/points': '/standings?rules=1',
  '/drivers-teams': '/league',
  '/donate': '/league',
  '/support': '/league',
  '/dues': '/league?dues=1',
};

/** Alias destinations that land on a query-driven view of the surface that absorbed them. */
const QUERY_FOR_PAGE: Partial<Record<Page, string>> = {
  'duesPayment': 'dues=1',
};

const RACE_VIEW_FOR_PAGE: Partial<Record<Page, string>> = {
  'picks': 'picks',
  'gp-results': 'results',
  'race': 'picks',
};

export const pathForPage = (page: Page): string => {
  const base = PAGE_PATHS[page] ?? '/';
  const view = RACE_VIEW_FOR_PAGE[page];
  if (view) return `${base}?view=${view}`;
  const query = QUERY_FOR_PAGE[page];
  return query ? `${base}?${query}` : base;
};

/** Unknown paths fall back to home, matching the old switch's `default` branch. */
export const pageForPath = (pathname: string): Page => {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PATH_PAGES[normalized] ?? 'home';
};

/** Admin-only primitive gallery. Deliberately outside the Page union — it is not a surface. */
export const DEV_UI_PATH = '/dev/ui';
