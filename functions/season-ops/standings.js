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
      p22: Number(data.breakdown?.p22) || 0,
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

/**
 * The P22 Award: whoever picked the last-place finisher most often (breakdown.p22 counts the
 * events). An array because ties happen; empty when nobody ever backed the backmarker.
 */
const p22AwardOf = (standings) => {
  const most = Math.max(0, ...standings.map((r) => r.p22));
  if (most === 0) return [];
  return standings
    .filter((r) => r.p22 === most)
    .map(({ uid, displayName, p22, finalRank }) => ({ uid, displayName, p22Count: p22, finalRank }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
};

module.exports = { computeFinalStandings, podiumOf, finalPodiumOf, p22AwardOf };
