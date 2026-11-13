/**
 * Server scoring engine. services/scoringService.ts implements the same math independently for
 * the client; services/scoringParity.test.ts holds the two to identical results.
 */

const DEFAULT_POINTS = {
  grandPrixFinish: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  sprintFinish: [8, 7, 6, 5, 4, 3, 2, 1],
  fastestLap: 3,
  gpQualifying: [3, 2, 1],
  sprintQualifying: [3, 2, 1],
};

const getDriverPoints = (driverId, resultList, pointsList) => {
    if (!driverId || !resultList || !pointsList) return 0;
    const idx = resultList.indexOf(driverId);
    return idx !== -1 ? (pointsList[idx] || 0) : 0;
};

const calculateEventScore = (picks, results, system, drivers) => {
    if (!picks || !results) return { total: 0, breakdown: { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 } };

    const getTeamId = (driverId) => {
        if(results.driverTeams && results.driverTeams[driverId]) return results.driverTeams[driverId];
        const d = drivers.find(drv => drv.id === driverId);
        return d ? d.constructorId : null;
    };

    let gpPoints = 0, sprintPoints = 0, qualiPoints = 0, flPoints = 0, p22Count = 0;

    const teamIds = [...(picks.aTeams || []), picks.bTeam].filter(Boolean);
    results.grandPrixFinish?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) gpPoints += (system.grandPrixFinish[idx] || 0);
    });
    results.sprintFinish?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) sprintPoints += (system.sprintFinish[idx] || 0);
    });
    results.gpQualifying?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) qualiPoints += (system.gpQualifying[idx] || 0);
    });
    results.sprintQualifying?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) qualiPoints += (system.sprintQualifying[idx] || 0);
    });

    const driverIds = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean);
    driverIds.forEach(dId => {
        gpPoints += getDriverPoints(dId, results.grandPrixFinish, system.grandPrixFinish);
        sprintPoints += getDriverPoints(dId, results.sprintFinish, system.sprintFinish);
        qualiPoints += getDriverPoints(dId, results.gpQualifying, system.gpQualifying);
        qualiPoints += getDriverPoints(dId, results.sprintQualifying, system.sprintQualifying);
    });

    if (picks.fastestLap && picks.fastestLap === results.fastestLap) {
        flPoints += system.fastestLap;
    }

    // P22 Tracker Logic
    if (results.p22Driver && driverIds.includes(results.p22Driver)) {
        p22Count = 1;
    }

    let total = gpPoints + sprintPoints + qualiPoints + flPoints;

    if (picks.penalty && picks.penalty > 0) {
        const deduction = Math.ceil(total * picks.penalty);
        total -= deduction;
    }

    return { total, breakdown: { gp: gpPoints, sprint: sprintPoints, quali: qualiPoints, fl: flPoints, p22: p22Count } };
};

/** `data` is app_state/scoring_config, or undefined when the doc does not exist. */
const resolvePointsSystem = (data) => {
    if (!data) return DEFAULT_POINTS;
    if (data.profiles && data.activeProfileId) {
        const active = data.profiles.find(p => p.id === data.activeProfileId);
        return active ? active.config : DEFAULT_POINTS;
    }
    return data.profiles ? DEFAULT_POINTS : data;
};

/** One member's season total from their userPicks doc. */
const scoreUserSeason = (allUserPicks, raceResults, pointsSystem, driversList, scoredEventIds, cancelledEventIds) => {
    let totalPoints = 0;
    let breakdown = { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 };

    Object.keys(allUserPicks).forEach(eventId => {
        // Picks are keyed by event id and outlive the calendar, so only events the season
        // config names may score — otherwise a prior-season pick keeps scoring here.
        if (!scoredEventIds.has(eventId)) return;
        // Skip cancelled events — no points awarded
        if (cancelledEventIds.has(eventId)) return;
        const result = raceResults[eventId];
        if (result) {
            const systemToUse = result.scoringSnapshot || pointsSystem;
            const score = calculateEventScore(allUserPicks[eventId], result, systemToUse, driversList);
            totalPoints += score.total;
            breakdown.gp += score.breakdown.gp;
            breakdown.sprint += score.breakdown.sprint;
            breakdown.quali += score.breakdown.quali;
            breakdown.fl += score.breakdown.fl;
            if (score.breakdown.p22) {
                breakdown.p22 = (breakdown.p22 || 0) + score.breakdown.p22;
            }
        }
    });

    return { totalPoints, breakdown };
};

module.exports = { DEFAULT_POINTS, calculateEventScore, resolvePointsSystem, scoreUserSeason };
