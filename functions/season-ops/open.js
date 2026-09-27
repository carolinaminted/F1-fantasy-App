/**
 * setup → active. The new season's calendar (app_state/season_calendar) becomes the list of
 * scored events — set here with the Admin SDK, never by a client — and maintenance is lifted.
 */
const openSeason = async (db, { seasonId, FieldValue }) => {
  const fail = (why) => { throw new Error(`cannot open season: ${why}`); };
  const [configSnap, calendarSnap] = await Promise.all([
    db.doc('season_config/current').get(),
    db.doc('app_state/season_calendar').get(),
  ]);
  if (!configSnap.exists) fail('season_config/current is missing');
  const config = configSnap.data();
  if (config.activeSeasonId !== seasonId) fail(`active season is ${config.activeSeasonId}, not ${seasonId}`);
  if (config.status !== 'setup') fail(`status is ${config.status}`);
  const calendar = calendarSnap.exists ? calendarSnap.data() : {};
  if (calendar.seasonId !== seasonId) fail(`the calendar is for ${calendar.seasonId || 'no season'}, not ${seasonId}`);
  if (!Array.isArray(calendar.events) || calendar.events.length === 0) fail('the calendar has no events');

  const scoredEventIds = [...calendar.events].sort((a, b) => a.round - b.round).map((e) => e.id);
  await db.doc('season_config/current').update({ status: 'active', scoredEventIds });
  await db.doc('app_state/maintenance').set({ enabled: false }, { merge: true });
  await db.doc(`season_ops/${seasonId}`).set({ open: {
    state: 'done', at: FieldValue.serverTimestamp(), scoredEventIds,
  } }, { merge: true });
  return { scoredEventIds };
};

module.exports = { openSeason };
