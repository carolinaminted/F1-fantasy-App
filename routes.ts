import type { Page } from './App.tsx';

/**
 * URL <-> Page mapping. Gate 2 gives every existing surface a real URL without changing
 * the information architecture, so this is deliberately a 1:1 translation of the `Page`
 * union that App.tsx has always used. The IA merge in a later gate rewrites this table.
 */
export const PAGE_PATHS: Record<Page, string> = {
  'home': '/',
  'picks': '/picks',
  'leaderboard': '/leaderboard',
  'profile': '/profile',
  'admin': '/admin',
  'points': '/points',
  'donate': '/donate',
  'support': '/support',
  'gp-results': '/gp-results',
  'duesPayment': '/dues',
  'drivers-teams': '/drivers-teams',
  'schedule': '/schedule',
  'league-hub': '/league',
};

const PATH_PAGES = Object.entries(PAGE_PATHS).reduce<Record<string, Page>>(
  (acc, [page, path]) => { acc[path] = page as Page; return acc; },
  {}
);

export const pathForPage = (page: Page): string => PAGE_PATHS[page] ?? '/';

/** Unknown paths fall back to home, matching the old switch's `default` branch. */
export const pageForPath = (pathname: string): Page => {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return PATH_PAGES[normalized] ?? 'home';
};

/** Admin-only primitive gallery. Deliberately outside the Page union — it is not a surface. */
export const DEV_UI_PATH = '/dev/ui';
