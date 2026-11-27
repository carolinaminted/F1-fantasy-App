// Mirrors REDIRECTS in routes.ts; lib/redirects.test.ts fails when the two drift.
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
