/**
 * Final standings exactly as the Standings page shows them (services/scoringService.ts,
 * processLeaderboardStats): points descending, then name; tied points share a place ("1224"),
 * so a season can have co-champions. The stored public_users.rank is not used — the server
 * assigns it by array position, so it never shares a place.
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
