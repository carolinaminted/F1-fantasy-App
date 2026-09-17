/**
 * The 2026 event ids, for the server scoring engine.
 *
 * This is a mirror of `EVENTS` in the repo-root `constants.ts`. That file is TypeScript and
 * this package is CommonJS, so it cannot be imported here — the list is duplicated on purpose
 * and must be kept in step with `constants.ts` and `backend/api/season-events.js`.
 *
 * Why it exists: `recalculateEntireLeague` iterates the *keys of each user's picks document*,
 * not the calendar. Without this allow-list, a pick for an event that has been dropped from the
 * calendar keeps scoring server-side while the client (`services/scoringService.ts`, which does
 * filter against `EVENTS`) drops it — so the leaderboard and every client-computed total
 * silently disagree.
 */
const SEASON_EVENT_IDS = new Set([
    'aus_26', 'chn_26', 'jpn_26', 'mia_26', 'can_26', 'mco_26', 'esp_26', 'aut_26',
    'gbr_26', 'bel_26', 'hun_26', 'nld_26', 'ita_26', 'mad_26', 'aze_26', 'bhr_26',
    'sgp_26', 'usa_26', 'mex_26', 'bra_26', 'las_26', 'qat_26', 'abu_26',
]);

module.exports = { SEASON_EVENT_IDS };
