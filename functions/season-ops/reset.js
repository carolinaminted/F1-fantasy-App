/**
 * archived → setup for the next season. Clears the live league (standings, results, locks, picks,
 * cancellations) and carries every member over as Unpaid. The archive, career stats, entities,
 * scoring and schedules are left alone; admins reconfigure the new season during setup.
 *
 * Each step is idempotent and the status changes last, so a run that dies partway is re-run.
 */
const ZERO_BREAKDOWN = { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 };

const toMillis = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : new Date(t).getTime());

const resetSeason = async (db, { seasonId, FieldValue }) => {
  const fail = (why) => { throw new Error(`cannot start new season: ${why}`); };
  const [configSnap, opsSnap, archiveSnap] = await Promise.all([
    db.doc('season_config/current').get(),
    db.doc(`season_ops/${seasonId}`).get(),
    db.doc(`season_archives/${seasonId}`).get(),
  ]);
  if (!configSnap.exists) fail('season_config/current is missing');
  const config = configSnap.data();
  if (config.activeSeasonId !== seasonId) fail(`active season is ${config.activeSeasonId}, not ${seasonId}`);
  if (!/^\d{4}$/.test(seasonId)) fail(`${seasonId} is not a season year`);
  if (config.status !== 'archived') fail(`status is ${config.status}`);
  const ops = opsSnap.exists ? opsSnap.data() : {};
  if (!archiveSnap.exists || ops.archive?.state !== 'verified') fail('the archive has not been verified');
  if (ops.backup?.state !== 'done') fail('there is no completed backup');
  if (!(toMillis(ops.backup.at) > toMillis(ops.archive.finishedAt))) fail('the backup is older than the archive');

  const nextSeasonId = String(Number(seasonId) + 1);
  const [publicSnap, picksSnap, usersSnap] = await Promise.all([
    db.collection('public_users').get(),
    db.collection('userPicks').get(),
    db.collection('users').get(),
  ]);

  await db.doc('app_state/maintenance').set(
    { enabled: true, message: `The league is being set up for the ${nextSeasonId} season.` },
    { merge: true },
  );

  const clearWriter = db.bulkWriter();
  publicSnap.docs.forEach((d) => clearWriter.set(d.ref, {
    ...d.data(), totalPoints: 0, rank: 999, breakdown: ZERO_BREAKDOWN,
  }));
  picksSnap.docs.forEach((d) => clearWriter.delete(d.ref));
  await clearWriter.close();

  await db.doc('app_state/race_results').set({});
  await db.doc('app_state/form_locks').set({});
  // Last of the clears: its trigger then recalculates an already-zeroed league.
  await db.doc('app_state/cancelled_events').set({ events: {} });

  const duesWriter = db.bulkWriter();
  usersSnap.docs.forEach((d) => duesWriter.set(d.ref, { ...d.data(), duesPaidStatus: 'Unpaid' }));
  await duesWriter.close();

  // The old season's finish stays in its archive; the new config must not carry it.
  await db.doc('season_config/current').update({
    activeSeasonId: nextSeasonId, label: `${nextSeasonId} Season`, status: 'setup', scoredEventIds: [],
    champions: FieldValue.delete(), podium: FieldValue.delete(),
    finalPodium: FieldValue.delete(), concludedAt: FieldValue.delete(),
  });
  const counts = { members: publicSnap.size, picksCleared: picksSnap.size, users: usersSnap.size };
  await db.doc(`season_ops/${seasonId}`).set({ reset: {
    state: 'done', at: FieldValue.serverTimestamp(), nextSeasonId, counts,
  } }, { merge: true });
  return { nextSeasonId, counts };
};

module.exports = { resetSeason };
