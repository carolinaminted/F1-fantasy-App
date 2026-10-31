/**
 * Final standings exactly as the Standings page shows them: points descending, tied points share
 * a place ("1224"), so a season can have co-champions. Recomputed here rather than read from
 * public_users.rank so the archive is self-consistent even if a recalc is pending; the ranking
 * rule must stay identical to recalculateEntireLeague in functions/index.js ([M-5]).
 */
const EXCLUDED_DISPLAY_NAMES = new Set(['Admin Principal']);

const computeFinalStandings = (publicUsers) => {
  const rows = publicUsers
    .filter(({ data }) => !EXCLUDED_DISPLAY_NAMES.has(data.displayName))
    .map(({ uid, data }) => ({
      uid,
      displayName: data.displayName || '',
      totalPoints: Number.isFinite(Number(data.totalPoints)) ? Number(data.totalPoints) : 0,
    }))
    .sort((a, b) => (b.totalPoints - a.totalPoints) || a.displayName.localeCompare(b.displayName));
  rows.forEach((row, i) => {
    row.finalRank = i > 0 && row.totalPoints === rows[i - 1].totalPoints ? rows[i - 1].finalRank : i + 1;
  });
  return rows;
};

/** The season's podium as shown in the Hall of Fame: every member at rank 3 or better. */
const podiumOf = (standings) => ({
  champions: standings.filter((r) => r.finalRank === 1).map((r) => r.uid),
  podium: standings.filter((r) => r.finalRank <= 3).map((r) => r.uid),
});

/** Names and points of everyone at rank 3 or better, for display without further reads. */
const finalPodiumOf = (standings) => standings
  .filter((r) => r.finalRank <= 3)
  .map(({ uid, displayName, totalPoints, finalRank }) => ({ uid, displayName, totalPoints, finalRank }));

module.exports = { computeFinalStandings, podiumOf, finalPodiumOf };
