/**
 * Full managed export of the league database to Cloud Storage, taken after the archive and before
 * Start new season ([ROLL-10]). This is the safety net for the reset, separate from the archive:
 * `gcloud firestore import <outputUri>` restores it, overwriting documents with the same ids.
 *
 * `exportDocuments` is injected so tests need no Firestore Admin client; it resolves once the
 * export operation has finished.
 */
const backupLeague = async (db, { seasonId, FieldValue, exportDocuments, projectId, bucket, now = () => new Date() }) => {
  const fail = (why) => { throw new Error(`cannot take backup: ${why}`); };
  const [configSnap, opsSnap] = await Promise.all([
    db.doc('season_config/current').get(),
    db.doc(`season_ops/${seasonId}`).get(),
  ]);
  if (!configSnap.exists) fail('season_config/current is missing');
  const config = configSnap.data();
  if (config.activeSeasonId !== seasonId) fail(`active season is ${config.activeSeasonId}, not ${seasonId}`);
  if (config.status !== 'archived') fail(`status is ${config.status}`);
  if (opsSnap.data()?.archive?.state !== 'verified') fail('the archive has not been verified');
  if (!bucket) fail(`there is no backup bucket for ${projectId}`);

  const outputUri = `gs://${bucket}/season-${seasonId}/${now().toISOString()}`;
  const opsRef = db.doc(`season_ops/${seasonId}`);
  await opsRef.set({ backup: { state: 'running', startedAt: FieldValue.serverTimestamp(), outputUri } }, { merge: true });

  let operation;
  try {
    operation = await exportDocuments({
      name: `projects/${projectId}/databases/(default)`, outputUriPrefix: outputUri, collectionIds: [],
    });
  } catch (err) {
    await opsRef.update({ backup: {
      state: 'failed', at: FieldValue.serverTimestamp(), outputUri, error: err.message,
    } });
    throw err;
  }

  // update() replaces the whole map, so nothing from an earlier failed run survives. `at` is the
  // completion time: Start new season requires it to be later than the archive.
  await opsRef.update({ backup: {
    state: 'done', at: FieldValue.serverTimestamp(), outputUri, operation: operation.name,
  } });
  return { outputUri };
};

module.exports = { backupLeague };
