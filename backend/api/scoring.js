const { FieldValue } = require('firebase-admin/firestore');

const DEFAULT_POINTS = {
  grandPrixFinish: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  sprintFinish: [8, 7, 6, 5, 4, 3, 2, 1],
  fastestLap: 3,
  gpQualifying: [3, 2, 1],
  sprintQualifying: [3, 2, 1],
};

const getDriverPoints = (driverId, resultList, pointsList) => {
  if (!driverId || !resultList || !pointsList) return 0;
  const index = resultList.indexOf(driverId);
  return index !== -1 ? (pointsList[index] || 0) : 0;
};

const calculateEventScore = (picks, results, system, drivers) => {
  if (!picks || !results) {
    return { total: 0, breakdown: { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 } };
  }

  const getTeamId = (driverId) => {
    if (results.driverTeams && results.driverTeams[driverId]) {
      return results.driverTeams[driverId];
    }
    const driver = drivers.find((candidate) => candidate.id === driverId);
    return driver ? driver.constructorId : null;
  };

  let gpPoints = 0;
  let sprintPoints = 0;
  let qualiPoints = 0;
  let flPoints = 0;
  let p22Count = 0;

  const teamIds = [...(picks.aTeams || []), picks.bTeam].filter(Boolean);
  results.grandPrixFinish?.forEach((driverId, index) => {
    if (driverId && teamIds.includes(getTeamId(driverId))) {
      gpPoints += system.grandPrixFinish[index] || 0;
    }
  });
  results.sprintFinish?.forEach((driverId, index) => {
    if (driverId && teamIds.includes(getTeamId(driverId))) {
      sprintPoints += system.sprintFinish[index] || 0;
    }
  });
  results.gpQualifying?.forEach((driverId, index) => {
    if (driverId && teamIds.includes(getTeamId(driverId))) {
      qualiPoints += system.gpQualifying[index] || 0;
    }
  });
  results.sprintQualifying?.forEach((driverId, index) => {
    if (driverId && teamIds.includes(getTeamId(driverId))) {
      qualiPoints += system.sprintQualifying[index] || 0;
    }
  });

  const driverIds = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean);
  driverIds.forEach((driverId) => {
    gpPoints += getDriverPoints(driverId, results.grandPrixFinish, system.grandPrixFinish);
    sprintPoints += getDriverPoints(driverId, results.sprintFinish, system.sprintFinish);
    qualiPoints += getDriverPoints(driverId, results.gpQualifying, system.gpQualifying);
    qualiPoints += getDriverPoints(
      driverId,
      results.sprintQualifying,
      system.sprintQualifying,
    );
  });

  if (picks.fastestLap && picks.fastestLap === results.fastestLap) {
    flPoints += system.fastestLap;
  }

  if (results.p22Driver && driverIds.includes(results.p22Driver)) {
    p22Count = 1;
  }

  let total = gpPoints + sprintPoints + qualiPoints + flPoints;
  if (picks.penalty && picks.penalty > 0) {
    total -= Math.ceil(total * picks.penalty);
  }

  return {
    total,
    breakdown: {
      gp: gpPoints,
      sprint: sprintPoints,
      quali: qualiPoints,
      fl: flPoints,
      p22: p22Count,
    },
  };
};

const recalculateEntireLeague = async (db) => {
  console.info(JSON.stringify({ message: 'Starting full league recalculation' }));

  const [resultsSnap, picksSnap, scoringSnap, entitiesSnap, usersSnap, cancelledSnap] =
    await Promise.all([
      db.collection('app_state').doc('race_results').get(),
      db.collection('userPicks').get(),
      db.collection('app_state').doc('scoring_config').get(),
      db.collection('app_state').doc('entities').get(),
      db.collection('users').get(),
      db.collection('app_state').doc('cancelled_events').get(),
    ]);

  if (!resultsSnap.exists) {
    console.warn(JSON.stringify({ message: 'Recalculation skipped: no race results found' }));
    return 0;
  }

  const raceResults = resultsSnap.data();
  const driversList = entitiesSnap.exists ? (entitiesSnap.data().drivers || []) : [];
  const userProfileMap = {};
  usersSnap.forEach((document) => {
    userProfileMap[document.id] = document.data().displayName || 'Unknown Team';
  });

  let pointsSystem = DEFAULT_POINTS;
  if (scoringSnap.exists) {
    const data = scoringSnap.data();
    if (data.profiles && data.activeProfileId) {
      const activeProfile = data.profiles.find((profile) => profile.id === data.activeProfileId);
      if (activeProfile) pointsSystem = activeProfile.config;
    } else if (!data.profiles) {
      pointsSystem = data;
    }
  }

  const cancelledEventIds = new Set(
    cancelledSnap.exists && cancelledSnap.data().events
      ? Object.keys(cancelledSnap.data().events)
      : [],
  );
  const leaderboardScores = [];

  picksSnap.forEach((pickDocument) => {
    const userId = pickDocument.id;
    const allUserPicks = pickDocument.data();
    let totalPoints = 0;
    const breakdown = { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 };

    Object.keys(allUserPicks).forEach((eventId) => {
      if (cancelledEventIds.has(eventId)) return;
      const result = raceResults[eventId];
      if (!result) return;

      const systemToUse = result.scoringSnapshot || pointsSystem;
      const score = calculateEventScore(
        allUserPicks[eventId],
        result,
        systemToUse,
        driversList,
      );
      totalPoints += score.total;
      breakdown.gp += score.breakdown.gp;
      breakdown.sprint += score.breakdown.sprint;
      breakdown.quali += score.breakdown.quali;
      breakdown.fl += score.breakdown.fl;
      if (score.breakdown.p22) breakdown.p22 += score.breakdown.p22;
    });

    leaderboardScores.push({
      userId,
      displayName: userProfileMap[userId] || `Team ${userId.substring(0, 4)}`,
      totalPoints,
      breakdown,
    });
  });

  leaderboardScores.sort((left, right) => right.totalPoints - left.totalPoints);
  const batch = db.batch();
  leaderboardScores.forEach((score, index) => {
    batch.set(
      db.collection('public_users').doc(score.userId),
      {
        displayName: score.displayName,
        totalPoints: score.totalPoints,
        breakdown: score.breakdown,
        rank: index + 1,
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  await batch.commit();
  console.info(
    JSON.stringify({
      message: 'Full league recalculation complete',
      usersProcessed: leaderboardScores.length,
    }),
  );
  return leaderboardScores.length;
};

module.exports = {
  calculateEventScore,
  recalculateEntireLeague,
};
