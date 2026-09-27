const { planArchive, diffArchive, computeCareerStats } = require('./archive-plan');

/**
 * Freeze a concluded season into season_archives/{seasonId}, verify the copy against what was
 * read, then publish meta and career_stats and mark the season archived. Outside the archive,
 * only season_config/current.status is written, and only after verify passes.
 *
 * Re-runnable: identical live data yields an identical archive, and archive docs that fall out of
 * the plan are deleted (inside season_archives/{seasonId} only).
 */
const ARCHIVE_KINDS = ['state', 'picks', 'standings'];

const readCollection = async (db, path) => {
  const snap = await db.collection(path).get();
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
};

const readArchive = async (db, root) => {
  const out = {};
  for (const kind of ARCHIVE_KINDS) {
    Object.entries(await readCollection(db, `${root}/${kind}`))
      .forEach(([id, data]) => { out[`${root}/${kind}/${id}`] = data; });
  }
  return out;
};

const archiveSeason = async (db, { seasonId, notes = '', FieldValue }) => {
  const configSnap = await db.doc('season_config/current').get();
  const seasonConfig = configSnap.exists ? configSnap.data() : null;
  if (!seasonConfig) throw new Error('season_config/current is missing');
  if (seasonConfig.activeSeasonId !== seasonId) {
    throw new Error(`active season is ${seasonConfig.activeSeasonId}, not ${seasonId}`);
  }
  if (!['concluded', 'archived'].includes(seasonConfig.status)) {
    throw new Error(`status is ${seasonConfig.status}; conclude the season before archiving`);
  }

  const opsRef = db.doc(`season_ops/${seasonId}`);
  await opsRef.set({ archive: { state: 'running', startedAt: FieldValue.serverTimestamp() } }, { merge: true });

  const live = {
    seasonConfig,
    appState: await readCollection(db, 'app_state'),
    picks: await readCollection(db, 'userPicks'),
    publicUsers: await readCollection(db, 'public_users'),
  };
  const { writes, meta } = planArchive(live, seasonId);

  const root = `season_archives/${seasonId}`;
  const planned = new Set(writes.map((w) => w.path));
  const stale = Object.keys(await readArchive(db, root)).filter((p) => !planned.has(p));

  const writer = db.bulkWriter();
  writes.forEach(({ path, data }) => writer.set(db.doc(path), data));
  stale.forEach((path) => writer.delete(db.doc(path)));
  await writer.close();

  const mismatches = diffArchive(writes, await readArchive(db, root));
  if (mismatches.length) {
    await opsRef.set({ archive: {
      state: 'failed', finishedAt: FieldValue.serverTimestamp(), mismatches: mismatches.slice(0, 20),
    } }, { merge: true });
    return { ok: false, mismatches, counts: meta.counts };
  }

  // Written before career stats: listing season_archives only returns seasons whose meta exists.
  await db.doc(root).set({ ...meta, notes, archivedAt: FieldValue.serverTimestamp() });

  const archives = [];
  for (const { id } of (await db.collection('season_archives').get()).docs) {
    const standings = Object.entries(await readCollection(db, `season_archives/${id}/standings`))
      .map(([uid, d]) => ({ uid, finalRank: d.finalRank, totalPoints: Number(d.totalPoints) || 0 }));
    archives.push({ seasonId: id, standings });
  }
  const careerWriter = db.bulkWriter();
  Object.entries(computeCareerStats(archives))
    .forEach(([uid, stats]) => careerWriter.set(db.doc(`career_stats/${uid}`), stats));
  await careerWriter.close();

  await db.doc('season_config/current').update({ status: 'archived' });
  await opsRef.set({ archive: {
    state: 'verified', finishedAt: FieldValue.serverTimestamp(), counts: meta.counts, mismatches: [],
  } }, { merge: true });
  return { ok: true, mismatches: [], counts: meta.counts };
};

module.exports = { archiveSeason };
