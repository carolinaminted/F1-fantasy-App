const { isDeepStrictEqual } = require('node:util');
const { computeFinalStandings, podiumOf, finalPodiumOf } = require('./standings');

/**
 * Every app_state document must be classified. Season-scoped state is frozen into the archive;
 * league-wide or ephemeral state is not. An unknown document stops the archive — a new doc must
 * be classified deliberately, or a season could be archived without it and then reset away.
 */
const APP_STATE_POLICY = {
  archive: ['race_results', 'event_schedules', 'form_locks', 'cancelled_events', 'scoring_config', 'entities', 'season_calendar'],
  // staging_seed_metadata is the marker functions/scripts/seed-staging.js leaves; it describes the
  // environment, not a season, and never exists in production.
  skip: ['league_config', 'maintenance', 'general_announcement', 'results_announcement', 'staging_seed_metadata'],
};

/**
 * The full set of archive writes for one season. Everything is copied verbatim — in particular
 * picks, whose slot arrays are the only record of the class each pick was made under.
 */
const planArchive = (live, seasonId) => {
  const root = `season_archives/${seasonId}`;
  const unclassified = Object.keys(live.appState)
    .filter((id) => !APP_STATE_POLICY.archive.includes(id) && !APP_STATE_POLICY.skip.includes(id));
  if (unclassified.length) throw new Error(`unclassified app_state document: ${unclassified.join(', ')}`);

  const standings = computeFinalStandings(
    Object.entries(live.publicUsers).map(([uid, data]) => ({ uid, data })),
  );

  const writes = [
    ...APP_STATE_POLICY.archive
      .filter((id) => id in live.appState)
      .map((id) => ({ path: `${root}/state/${id}`, data: live.appState[id] })),
    { path: `${root}/state/season_config`, data: live.seasonConfig },
    ...Object.entries(live.picks).map(([uid, data]) => ({ path: `${root}/picks/${uid}`, data })),
    ...standings.map(({ uid, finalRank }) => ({
      path: `${root}/standings/${uid}`,
      data: { ...live.publicUsers[uid], finalRank },
    })),
  ];

  const count = (kind) => writes.filter((w) => w.path.startsWith(`${root}/${kind}/`)).length;
  const meta = {
    seasonId,
    label: live.seasonConfig.label,
    scoredEventIds: live.seasonConfig.scoredEventIds,
    ...podiumOf(standings),
    finalPodium: finalPodiumOf(standings),
    counts: { state: count('state'), picks: count('picks'), standings: count('standings') },
  };
  return { writes, meta, standings };
};

/** Every way the stored archive can differ from the plan: missing, extra, or changed documents. */
const diffArchive = (writes, readBack) => {
  const expected = new Map(writes.map((w) => [w.path, w.data]));
  const out = [];
  expected.forEach((data, path) => {
    if (!(path in readBack)) out.push(`missing: ${path}`);
    else if (!isDeepStrictEqual(readBack[path], data)) out.push(`differs: ${path}`);
  });
  Object.keys(readBack).forEach((path) => { if (!expected.has(path)) out.push(`extra: ${path}`); });
  return out;
};

/** Career stats per member, derived from every archived season's final standings. */
const computeCareerStats = (archives) => {
  const stats = {};
  archives.forEach(({ seasonId, standings }) => {
    standings.forEach(({ uid, finalRank, totalPoints }) => {
      const s = stats[uid] || (stats[uid] = {
        seasonsPlayed: 0, championships: 0, podiums: 0, bestFinish: null, totalPoints: 0, seasons: {},
      });
      s.seasonsPlayed += 1;
      // A title is counted as a championship, not also as a podium (user decision 2026-09-27).
      if (finalRank === 1) s.championships += 1;
      else if (finalRank <= 3) s.podiums += 1;
      s.bestFinish = s.bestFinish === null ? finalRank : Math.min(s.bestFinish, finalRank);
      s.totalPoints += totalPoints;
      s.seasons[seasonId] = { finalRank, totalPoints };
    });
  });
  return stats;
};

module.exports = { APP_STATE_POLICY, planArchive, diffArchive, computeCareerStats };
