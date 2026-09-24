/**
 * Podium Survival Challenge engine. Pure: no Firestore, no clock unless one is passed in.
 * See docs/superpowers/specs/2026-09-23-podium-survival-design.md for the rules.
 */

const PODIUM_SIZE = 3;
const MAX_DRIVER_USES = 3;

/** The challenge's rounds, in calendar order: from the start event on, cancelled ones dropped. */
const eventsInPlay = (eventOrder, startEventId, cancelled = {}) => {
  const start = eventOrder.indexOf(startEventId);
  if (start === -1) return [];
  return eventOrder.slice(start).filter((id) => !cancelled[id]);
};

const hasGpResult = (result) =>
  Array.isArray(result?.grandPrixFinish) && result.grandPrixFinish.some(Boolean);

/** 1-based finishing position, or null when the driver is outside the recorded P1–P10. */
const positionIn = (finish, driverId) => {
  const idx = finish.indexOf(driverId);
  return idx === -1 ? null : idx + 1;
};

const newPlayer = () => ({ alive: true, eliminatedAt: null, reason: null, usage: {}, rounds: {} });

const eliminate = (player, eventId, reason) => {
  player.alive = false;
  player.eliminatedAt = eventId;
  player.reason = reason;
};

const computeSurvivalStandings = ({ config, picksByUser = {}, results = {}, cancelled = {}, eventOrder }) => {
  if (!config || config.status !== 'active') return null;

  const entrants = Array.isArray(config.entrants) ? config.entrants : [];
  const rounds = eventsInPlay(eventOrder, config.startEventId, cancelled);
  const finalEventId = rounds.length ? rounds[rounds.length - 1] : null;

  const players = {};
  entrants.forEach((uid) => { players[uid] = newPlayer(); });

  const standings = {
    status: 'active', winners: [], decidedAt: null, lastProcessedEventId: null, finalEventId, players,
  };
  const finish = (eventId, winners) => {
    standings.status = 'complete';
    standings.winners = winners;
    standings.decidedAt = eventId;
    return standings;
  };

  if (entrants.length === 0) return finish(null, []);

  for (const eventId of rounds) {
    const result = results[eventId];
    if (!hasGpResult(result)) break;

    const order = result.grandPrixFinish;
    const isFinal = eventId === finalEventId;
    const alive = entrants.filter((uid) => players[uid].alive);
    const contenders = [];

    for (const uid of alive) {
      const player = players[uid];
      const driverId = picksByUser[uid]?.[eventId]?.driverId || null;
      const overBudget = driverId && (player.usage[driverId] || 0) >= MAX_DRIVER_USES;

      if (!driverId || overBudget) {
        player.rounds[eventId] = { driverId, position: null, outcome: 'missed' };
        eliminate(player, eventId, 'missed');
        continue;
      }

      player.usage[driverId] = (player.usage[driverId] || 0) + 1;
      const position = positionIn(order, driverId);

      if (isFinal) {
        player.rounds[eventId] = { driverId, position, outcome: 'eliminated' };
        contenders.push(uid);
      } else if (position !== null && position <= PODIUM_SIZE) {
        player.rounds[eventId] = { driverId, position, outcome: 'survived' };
      } else {
        player.rounds[eventId] = { driverId, position, outcome: 'eliminated' };
        eliminate(player, eventId, 'off-podium');
      }
    }

    standings.lastProcessedEventId = eventId;

    if (isFinal) {
      if (contenders.length === 0) return finish(eventId, []);
      const rank = (uid) => players[uid].rounds[eventId].position ?? Infinity;
      const best = Math.min(...contenders.map(rank));
      const winners = contenders.filter((uid) => rank(uid) === best);
      contenders.forEach((uid) => {
        if (winners.includes(uid)) players[uid].rounds[eventId].outcome = 'won';
        else eliminate(players[uid], eventId, 'final');
      });
      return finish(eventId, winners);
    }

    const survivors = alive.filter((uid) => players[uid].alive);
    if (survivors.length === 0) return finish(eventId, []);
    if (survivors.length === 1) return finish(eventId, survivors);
  }

  return standings;
};

module.exports = {
  PODIUM_SIZE,
  MAX_DRIVER_USES,
  eventsInPlay,
  computeSurvivalStandings,
};
