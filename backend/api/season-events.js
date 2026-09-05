/**
 * The 2026 event ids, for the containerised API's scoring engine.
 *
 * A mirror of `EVENTS` in the repo-root `constants.ts` and of `functions/season-events.js`.
 * `backend/api/` is a separate Docker build context, so it cannot share the Functions copy.
 * Change one, change all three.
 *
 * See `functions/season-events.js` for why the allow-list is needed at all.
 */
const SEASON_EVENT_IDS = new Set([
  'aus_26', 'chn_26', 'jpn_26', 'mia_26', 'can_26', 'mco_26', 'esp_26', 'aut_26',
  'gbr_26', 'bel_26', 'hun_26', 'nld_26', 'ita_26', 'mad_26', 'aze_26', 'bhr_26',
  'sgp_26', 'usa_26', 'mex_26', 'bra_26', 'las_26', 'qat_26', 'abu_26',
]);

module.exports = { SEASON_EVENT_IDS };
