const { computeFinalStandings, podiumOf, finalPodiumOf, p22AwardOf } = require('./standings');

/**
 * Mirrors hasAnyResult in components/Dashboard.tsx. Opening the results form and saving nothing
 * leaves a scaffold of nulls, which must not count as a result.
 */
const hasAnyResult = (r) => !!r && (
  (r.grandPrixFinish || []).some(Boolean) || !!r.fastestLap || (r.sprintFinish || []).some(Boolean)
  || (r.gpQualifying || []).some(Boolean) || (r.sprintQualifying || []).some(Boolean)
);

/**
 * active → concluded. Fixes the champion(s) and podium from the standings as they stand, with the
 * same ordering and shared places as the Standings page. Writes nothing unless every precondition
 * holds.
 */
const concludeSeason = async (db, { seasonId, FieldValue }) => {
  const fail = (why) => { throw new Error(`cannot conclude: ${why}`); };
  const configSnap = await db.doc('season_config/current').get();
  if (!configSnap.exists) fail('season_config/current is missing');
  const config = configSnap.data();
  if (config.activeSeasonId !== seasonId) fail(`active season is ${config.activeSeasonId}, not ${seasonId}`);
  if (config.status !== 'active') fail(`status is ${config.status}`);

  const [resultsSnap, cancelledSnap, publicSnap] = await Promise.all([
    db.doc('app_state/race_results').get(),
    db.doc('app_state/cancelled_events').get(),
    db.collection('public_users').get(),
  ]);
  const results = resultsSnap.exists ? resultsSnap.data() : {};
  const cancelled = new Set(Object.keys((cancelledSnap.exists && cancelledSnap.data().events) || {}));
  const missing = config.scoredEventIds.filter((id) => !cancelled.has(id) && !hasAnyResult(results[id]));
  if (missing.length) fail(`no results for ${missing.join(', ')}`);

  const standings = computeFinalStandings(publicSnap.docs.map((d) => ({ uid: d.id, data: d.data() })));
  const { champions, podium } = podiumOf(standings);
  // Names and points travel with the season config, so the Dashboard's champion hero needs no
  // reads of its own and shows the finish exactly as it stood when the season was concluded.
  const finalPodium = finalPodiumOf(standings);
  const p22Award = p22AwardOf(standings);

  await db.doc('season_config/current').update({
    status: 'concluded', concludedAt: FieldValue.serverTimestamp(), champions, podium, finalPodium, p22Award,
  });
  await db.doc(`season_ops/${seasonId}`).set({ conclude: {
    state: 'done', at: FieldValue.serverTimestamp(), champions, podium,
  } }, { merge: true });
  return { champions, podium };
};

module.exports = { concludeSeason, hasAnyResult };
