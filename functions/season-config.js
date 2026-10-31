/**
 * Which events score, read from `season_config/current`.
 *
 * Throws rather than returning an empty set. Scoring nothing would zero every member's total the
 * moment a trigger fired, so a missing or malformed document must stop the recalculation before
 * it writes.
 */
const parseScoredEventIds = (snapshot) => {
  if (!snapshot.exists) {
    throw new Error('season_config/current is missing; refusing to recalculate.');
  }
  const ids = snapshot.data().scoredEventIds;
  const valid = Array.isArray(ids)
    && ids.length > 0
    && ids.every((id) => typeof id === 'string' && id.length > 0);
  if (!valid) {
    throw new Error('season_config/current has no valid scoredEventIds; refusing to recalculate.');
  }
  return new Set(ids);
};

module.exports = { parseScoredEventIds };
