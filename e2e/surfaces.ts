import type { Locator, Page } from '@playwright/test';

export type Role = 'member' | 'admin' | 'anon';

export type Surface = {
  id: string;            // kebab-case, unique; used in file names
  path: string;          // URL path and query, starting with '/'
  role: Role;
  entries: string[];     // repo-relative components; selection follows their imports
  ready?: (page: Page) => Locator;   // an element to wait for after the default settle
  mask?: (page: Page) => Locator[];  // regions that differ between two runs of identical code (say why)
};

// Mirrors of app values; lib/surfaces.test.ts fails when either drifts from the app source.
export const STANDINGS_VIEWS = ['standings', 'executive', 'popular', 'entities', 'insights', 'p22', 'hall'] as const;
export const ADMIN_TOOLS = ['results', 'manage-users', 'scoring', 'entities', 'schedule', 'invitations', 'database', 'announcements', 'season'] as const;

const ADMIN_TOOL_ENTRY: Record<(typeof ADMIN_TOOLS)[number], string> = {
  results: 'components/ResultsManagerPage.tsx',
  'manage-users': 'components/ManageUsersPage.tsx',
  scoring: 'components/ScoringSettingsPage.tsx',
  entities: 'components/ManageEntitiesPage.tsx',
  schedule: 'components/ManageSchedulePage.tsx',
  invitations: 'components/AdminInvitationPage.tsx',
  database: 'components/DatabaseManagerPage.tsx',
  announcements: 'components/AdminAnnouncementsPage.tsx',
  season: 'components/admin/SeasonControlPage.tsx',
};

const RACE = 'components/RacePage.tsx';
const STANDINGS = 'components/LeaderboardPage.tsx';
const LEAGUE = 'components/LeagueHubPage.tsx';

export const SURFACES: Surface[] = [
  { id: 'signin', path: '/', role: 'anon', entries: ['components/AuthScreen.tsx'] },
  { id: 'home', path: '/', role: 'member', entries: ['components/Dashboard.tsx'] },
  { id: 'race-picks', path: '/race?view=picks', role: 'member', entries: [RACE] },
  { id: 'race-weekend', path: '/race?view=weekend', role: 'member', entries: [RACE] },
  { id: 'race-results', path: '/race?view=results', role: 'member', entries: [RACE] },
  // 'popular' is left out until fix/leaderboard-picks-fetch [H-3] merges. On staging the league's
  // picks come back empty, and LeaderboardPage's fetch effect re-runs on every empty result, so
  // getDocs(userPicks) loops ~15 times a second and the spinner never settles. Re-add it then, with
  // ready: page.getByRole('heading', { name: 'Trends', level: 2 }).
  ...STANDINGS_VIEWS.filter((v) => v !== 'popular').map((v): Surface => ({
    id: v === 'standings' ? 'standings' : `standings-${v}`,
    path: v === 'standings' ? '/standings' : `/standings?view=${v}`,
    role: 'member',
    entries: [STANDINGS],
  })),
  { id: 'standings-rules', path: '/standings?rules=1', role: 'member', entries: [STANDINGS] },
  { id: 'league', path: '/league', role: 'member', entries: [LEAGUE] },
  { id: 'league-dues', path: '/league?dues=1', role: 'member', entries: [LEAGUE] },
  { id: 'profile', path: '/profile', role: 'member', entries: ['components/ProfilePage.tsx'] },
  { id: 'admin', path: '/admin', role: 'admin', entries: ['components/AdminPage.tsx'] },
  ...ADMIN_TOOLS.map((t): Surface => ({ id: `admin-${t}`, path: `/admin?tool=${t}`, role: 'admin', entries: [ADMIN_TOOL_ENTRY[t]] })),
];
