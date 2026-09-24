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

const LEAGUE_TIMEZONE = 'America/New_York';

/** How far New York wall-clock time is ahead of UTC at instant `ms` (negative: behind). */
const leagueOffsetMs = (ms) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: LEAGUE_TIMEZONE, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - ms;
};

/**
 * Server twin of utils/dateUtils.ts `parseLeagueDate`. Admin-entered schedule times are bare
 * `datetime-local` strings meaning New York time; Cloud Functions run in UTC, so they cannot be
 * handed to `new Date()` as-is.
 */
const parseLeagueDate = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(trimmed)) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = trimmed.replace(' ', 'T').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  let instant = wall - leagueOffsetMs(wall);
  const corrected = wall - leagueOffsetMs(instant); // second pass settles DST boundaries
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
};

/**
 * The picks deadline, with the same precedence as App.tsx `mergedEvents`. The server has no copy
 * of constants.ts, so an event without an imported schedule resolves to null and the pick is refused.
 */
const resolveLockAt = (schedule) => {
  if (!schedule) return null;
  const raw = schedule.customLockAt
    || (schedule.hasSprint !== false ? (schedule.sprintQualifying || schedule.qualifying) : schedule.qualifying);
  return parseLeagueDate(raw);
};

const reject = (code, message) => ({ ok: false, code, message });

const validateSurvivalPick = ({
  uid, eventId, driverId, config, standings, picksDoc = {}, drivers = [], schedule,
  formLocked, cancelled = {}, now, eventOrder,
}) => {
  if (!config || config.status !== 'active') return reject('failed-precondition', 'The Survival Challenge is not running.');
  if (!(config.entrants || []).includes(uid)) return reject('permission-denied', 'You are not entered in this challenge.');
  if (standings?.status === 'complete') return reject('failed-precondition', 'The challenge is over.');
  if (standings?.players?.[uid]?.alive === false) return reject('failed-precondition', 'You have been eliminated.');

  const rounds = eventsInPlay(eventOrder, config.startEventId, {});
  if (!rounds.includes(eventId)) return reject('invalid-argument', 'That race is not part of the challenge.');
  if (cancelled[eventId]) return reject('failed-precondition', 'That race has been cancelled.');

  const lockAt = resolveLockAt(schedule);
  if (!lockAt) return reject('failed-precondition', 'That race has no lock time yet. Picks open once its schedule is set.');
  if (formLocked || now.getTime() >= lockAt.getTime()) return reject('failed-precondition', 'Picks for that race are locked.');

  if (!drivers.length) return reject('failed-precondition', 'The driver list is unavailable. Try again shortly.');
  const driver = drivers.find((d) => d.id === driverId && d.isActive !== false);
  if (!driver) return reject('invalid-argument', 'That driver is not available.');

  const uses = rounds.filter((id) => id !== eventId && !cancelled[id] && picksDoc[id]?.driverId === driverId).length;
  if (uses >= MAX_DRIVER_USES) {
    return reject('failed-precondition', `You have already picked ${driver.name} ${MAX_DRIVER_USES} times.`);
  }
  return { ok: true };
};

module.exports = {
  PODIUM_SIZE,
  MAX_DRIVER_USES,
  eventsInPlay,
  computeSurvivalStandings,
  parseLeagueDate,
  resolveLockAt,
  validateSurvivalPick,
};
