/**
 * League-wide pick counts per event, for the Standings "Popular" view, written to
 * app_state/pick_trends by recalculateEntireLeague so no client downloads every member's picks.
 *
 * Only events with results count. An upcoming event's picks are a strategy secret until it is
 * run, and counting it here would publish the league's consensus for it before lock.
 */
const countPickTrends = (picksByUser, raceResults, scoredEventIds, cancelledEventIds) => {
  const events = {};
  const bump = (bucket, id) => { if (id) bucket[id] = (bucket[id] || 0) + 1; };

  Object.values(picksByUser).forEach((userPicks) => {
    Object.entries(userPicks).forEach(([eventId, picks]) => {
      if (!scoredEventIds.has(eventId) || cancelledEventIds.has(eventId) || !raceResults[eventId]) return;
      const counts = events[eventId] || (events[eventId] = { teams: {}, drivers: {} });
      [...(picks.aTeams || []), picks.bTeam].forEach((id) => bump(counts.teams, id));
      [...(picks.aDrivers || []), ...(picks.bDrivers || [])].forEach((id) => bump(counts.drivers, id));
    });
  });

  return { events };
};

module.exports = { countPickTrends };
