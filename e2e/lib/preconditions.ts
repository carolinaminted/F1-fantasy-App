export type Doc = Record<string, unknown> | null;
export type StagingState = { season: Doc; calendar: Doc; maintenance: Doc; member: Doc; admin: Doc };

const NO_MEMBER = 'the e2e member has no users doc (run: npm run e2e:provision)';

// Each check returns null when met, otherwise what is wrong.
const CHECKS = {
  'maintenance-off': (s) => (s.maintenance?.enabled === true ? 'app_state/maintenance.enabled is true, so members see the red flag screen' : null),
  'calendar-present': (s) => { const events = s.calendar?.events; return Array.isArray(events) && events.length > 0 ? null : 'app_state/season_calendar has no events'; },
  'season-active': (s) => (s.season?.status === 'active' ? null : `season_config/current.status is "${s.season?.status ?? 'missing'}", expected "active"`),
  'member-is-not-admin': (s) => (!s.member ? NO_MEMBER : s.member.isAdmin === true ? 'the e2e member has isAdmin true' : null),
  // A missing field counts as unpaid, as it does in the app.
  'member-dues-unpaid': (s) => (!s.member ? NO_MEMBER : s.member.duesPaidStatus !== 'Paid' ? null : 'the e2e member duesPaidStatus is "Paid", so the dues sheet never opens'),
  'admin-is-admin': (s) => (s.admin?.isAdmin === true ? null : 'the e2e admin does not have isAdmin true (run: npm run e2e:provision)'),
} satisfies Record<string, (s: StagingState) => string | null>;

export type Precondition = keyof typeof CHECKS;

export const unmetPreconditions = (wanted: Precondition[], state: StagingState): string[] =>
  wanted.flatMap((name) => { const why = CHECKS[name](state); return why ? [`${name}: ${why}`] : []; });
