#!/usr/bin/env -S node --experimental-transform-types --no-warnings
//
// Read-only evidence gathering for a member dispute ("I submitted my picks but have no points").
// See the LOL Investigation Playbook in Notion; INV-001 is the worked example.
//
// Usage:
//   scripts/investigate-picks.mjs --inv INV-002 --email member@example.com --event sgp_26 [--event usa_26] [--slug short-name]
//
// Run it the day a dispute arrives. Picks saved since [PICK-02] carry a server submittedAt, but only
// for their latest save and nothing logs earlier ones, so the write history is still Firestore
// point-in-time recovery, which reaches back 7 days.
//
// It only ever issues GETs plus the two read-shaped POSTs (accounts:lookup, :runQuery), and it is
// pinned to formula-fantasy-1 with no override: there is nothing here that should run anywhere else.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculatePointsForEvent } from '../services/scoringService.ts';
import { EVENTS } from '../constants.ts';
import { parseLeagueDate } from '../utils/dateUtils.ts';

const PROJECT = 'formula-fantasy-1';
const ACCOUNT = 'jhh@carolinaminted.net';
const DB = `projects/${PROJECT}/databases/(default)`;
const DOCS = `https://firestore.googleapis.com/v1/${DB}/documents`;
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = { events: [] };
for (let i = 2; i < process.argv.length; i += 2) {
  const [flag, value] = [process.argv[i], process.argv[i + 1]];
  if (!value) usage(`missing value for ${flag}`);
  if (flag === '--inv') args.inv = value;
  else if (flag === '--email') args.email = value.toLowerCase();
  else if (flag === '--event') args.events.push(value);
  else if (flag === '--slug') args.slug = value;
  else usage(`unknown flag ${flag}`);
}
if (!/^INV-\d{3}$/.test(args.inv || '')) usage('--inv must look like INV-002');
if (!args.email) usage('--email is required');
if (args.events.length === 0) usage('at least one --event is required');

function usage(msg) {
  console.error(`error: ${msg}\nusage: scripts/investigate-picks.mjs --inv INV-### --email <email> --event <id> [--event <id>...] [--slug <name>]`);
  process.exit(2);
}

let token;
try {
  token = execFileSync('gcloud', ['auth', 'print-access-token', `--account=${ACCOUNT}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
} catch (e) {
  console.error(`gcloud token failed. Run in a terminal first:\n  gcloud auth login ${ACCOUNT}\n\n${e.stderr || e.message}`);
  process.exit(1);
}

const outDir = join(REPO, '.backups', `${args.inv}-${args.slug || args.email.split('@')[0].replace(/[^a-z0-9]+/g, '-')}`);
mkdirSync(outDir, { recursive: true });
const raw = {};
const save = (name, data) => { raw[name] = data; writeFileSync(join(outDir, `${name}.json`), JSON.stringify(data, null, 2)); };

async function api(method, url, body) {
  const readShaped = method === 'GET' || (method === 'POST' && /:(lookup|runQuery)$/.test(url));
  if (!readShaped) throw new Error(`refusing non-read request: ${method} ${url}`);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': PROJECT, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok && res.status !== 404) throw new Error(`${method} ${url} -> ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return res.status === 404 ? null : json;
}

const decode = (v) => {
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, decode(x)]));
  if (v.arrayValue) return (v.arrayValue.values || []).map(decode);
  if ('integerValue' in v) return Number(v.integerValue);
  if ('nullValue' in v) return null;
  return Object.values(v)[0];
};
const fields = (map) => (map ? decode({ mapValue: { fields: map } }) : null);
const getDoc = (path, readTime) => api('GET', `${DOCS}/${path}${readTime ? `?readTime=${readTime}` : ''}`);
const floorMinute = (iso) => { const d = new Date(iso); d.setUTCSeconds(0, 0); return d; };

// Walks a document's versions newest-first: read the doc as of the minute before each version's
// updateTime to get the previous version. PITR only serves whole-minute readTimes beyond the last
// hour, so several writes inside the same minute collapse into the last of them.
async function versionHistory(path, earliest) {
  const versions = [];
  let doc = await getDoc(path);
  while (doc) {
    versions.push(doc);
    let before = floorMinute(doc.updateTime);
    if (before.toISOString() === new Date(doc.updateTime).toISOString()) before = new Date(before - 60_000);
    if (before < earliest) break;
    doc = await getDoc(path, before.toISOString());
  }
  return versions;
}

// Firestore returns map keys in no fixed order, so compare values with sorted keys.
const canonical = (v) => JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort()) : x));
const fmt = (iso) => (iso ? new Date(iso).toISOString().replace('.000Z', 'Z') : '—');
const out = [];
const say = (line = '') => { out.push(line); console.log(line); };

const database = await api('GET', `https://firestore.googleapis.com/v1/${DB}`);
const pitr = database.pointInTimeRecoveryEnablement === 'POINT_IN_TIME_RECOVERY_ENABLED';
const earliest = new Date(database.earliestVersionTime);
say(`${args.inv} — ${args.email} — events ${args.events.join(', ')}`);
say(`PITR ${pitr ? 'on' : 'OFF'}; history reaches back to ${fmt(database.earliestVersionTime)}. Anything older is gone.`);

const lookup = await api('POST', `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, { email: [args.email] });
const authUser = lookup?.users?.[0];
if (!authUser) { say(`\nNo Auth account for ${args.email}.`); process.exit(1); }
const uid = authUser.localId;
save('auth', { uid, email: authUser.email, createdAt: fmt(+authUser.createdAt), lastLoginAt: fmt(+authUser.lastLoginAt), lastRefreshAt: authUser.lastRefreshAt, disabled: !!authUser.disabled });
say(`\n## Account\nuid ${uid}; created ${raw.auth.createdAt}; last sign-in ${raw.auth.lastLoginAt} (Auth keeps only the latest)`);

const [profile, schedules, results, scoringConfig, entities] = await Promise.all(
  ['users/' + uid, 'app_state/event_schedules', 'app_state/race_results', 'app_state/scoring_config', 'app_state/entities'].map((p) => getDoc(p)),
);
const displayName = fields(profile?.fields)?.displayName;
say(`display name "${displayName ?? '—'}" — search by email or uid, never by name`);
const schedule = fields(schedules?.fields) || {};
const allResults = fields(results?.fields) || {};
save('schedules', schedule);
save('race_results', { updateTime: results?.updateTime, events: Object.fromEntries(args.events.map((e) => [e, allResults[e] ?? null])) });

say('\n## Picks document');
const picksVersions = await versionHistory(`userPicks/${uid}`, earliest);
save('userPicks-versions', picksVersions);
const current = picksVersions[0];
if (!current) say('No userPicks document exists.');
else {
  say(`createTime ${fmt(current.createTime)}; updateTime ${fmt(current.updateTime)}`);
  say('An unchanged createTime rules out delete-and-recreate; any edit, including an admin removing a pick, moves updateTime.');
  say('\nWrites inside the PITR window (newest first):');
  for (let i = 0; i < picksVersions.length; i++) {
    const now = fields(picksVersions[i].fields);
    const prev = picksVersions[i + 1] ? fields(picksVersions[i + 1].fields) : null;
    if (!prev) {
      const inWindow = new Date(picksVersions[i].updateTime) >= earliest;
      say(`  ${fmt(picksVersions[i].updateTime)}  ${inWindow ? 'first write in window (earlier state unknown)' : 'last write BEFORE the window — nothing changed between this and the next line'}`);
      break;
    }
    const keys = new Set([...Object.keys(now), ...Object.keys(prev)]);
    const changes = [...keys].flatMap((k) => (!(k in prev) ? [`+${k}`] : !(k in now) ? [`-${k}`] : canonical(now[k]) !== canonical(prev[k]) ? [`~${k}`] : []));
    say(`  ${fmt(picksVersions[i].updateTime)}  ${changes.join(' ') || '(no field change)'}`);
  }
}

const picks = fields(current?.fields) || {};
let activeSystem = null;
const scoring = fields(scoringConfig?.fields);
if (scoring?.profiles && scoring.activeProfileId) activeSystem = scoring.profiles.find((p) => p.id === scoring.activeProfileId)?.config ?? null;
else if (scoring && !scoring.profiles) activeSystem = scoring;
const drivers = fields(entities?.fields)?.drivers || [];

say('\n## Requested events');
for (const eventId of args.events) {
  const s = schedule[eventId];
  say(`\n${eventId}: qualifying ${s?.qualifying ?? '?'} / race ${s?.race ?? '?'} (league time, America/New_York)`);
  if (!(eventId in picks)) { say('  no picks for this event in the current document'); continue; }
  say(`  picks ${JSON.stringify(picks[eventId])}`);
  // The lock rule App.tsx applies to the picks form, so "before lock" means what the member saw.
  const hasSprint = s?.hasSprint ?? EVENTS.find((e) => e.id === eventId)?.hasSprint;
  const lockAt = parseLeagueDate(s?.customLockAt || (hasSprint ? s?.sprintQualifying || s?.qualifying : s?.qualifying)
    || EVENTS.find((e) => e.id === eventId)?.lockAtUtc);
  const submittedAt = picks[eventId].submittedAt;
  if (!submittedAt) say(`  submittedAt none (saved before [PICK-02] shipped, or by an edit that dropped it); lock ${fmt(lockAt)}`);
  else {
    const verdict = !lockAt ? 'lock time unknown' : new Date(submittedAt) <= lockAt ? 'BEFORE lock' : 'AFTER lock';
    say(`  submittedAt ${fmt(submittedAt)}; lock ${fmt(lockAt)} — ${verdict} (server clock; marks the latest save only)`);
  }
  const res = allResults[eventId];
  if (!res) { say('  no results entered yet'); continue; }
  const pts = calculatePointsForEvent(picks[eventId], res, res.scoringSnapshot || activeSystem, drivers);
  say(`  re-scored with the client engine: ${pts.totalPoints} (GP ${pts.grandPrixPoints}, sprint ${pts.sprintPoints}, quali ${pts.gpQualifyingPoints + pts.sprintQualifyingPoints}, FL ${pts.fastestLapPoints}, penalty ${pts.penaltyPoints})`);
}

say('\n## Leaderboard total (public_users) inside the PITR window');
const scoreVersions = await versionHistory(`public_users/${uid}`, earliest);
save('public_users-versions', scoreVersions);
for (let i = 0; i < scoreVersions.length; i++) {
  const t = fields(scoreVersions[i].fields)?.totalPoints;
  const p = scoreVersions[i + 1] ? fields(scoreVersions[i + 1].fields)?.totalPoints : undefined;
  say(`  ${fmt(scoreVersions[i].updateTime)}  total ${t}${p !== undefined ? `  (${t - p >= 0 ? '+' : ''}${t - p})` : ''}`);
}

say('\n## Admin log entries for these events');
const logs = [];
for (const eventId of args.events) {
  const rows = await api('POST', `${DOCS}:runQuery`, {
    structuredQuery: { from: [{ collectionId: 'admin_logs' }], where: { fieldFilter: { field: { fieldPath: 'eventId' }, op: 'EQUAL', value: { stringValue: eventId } } } },
  });
  for (const r of rows) if (r.document) logs.push(fields(r.document.fields));
}
logs.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
save('admin_logs', logs);
if (logs.length === 0) say('  none (raw DatabaseManagerPage edits are never logged — rely on updateTime above)');
for (const l of logs) say(`  ${fmt(l.timestamp)}  ${l.eventId}  ${l.action}  by ${l.adminName}: ${String(l.changes ?? '').slice(0, 160)}`);

say('\n## Other accounts that could be the same person');
const users = [];
let pageToken;
do {
  const page = await api('GET', `${DOCS}/users?pageSize=300&mask.fieldPaths=displayName&mask.fieldPaths=email${pageToken ? `&pageToken=${pageToken}` : ''}`);
  users.push(...(page?.documents || []));
  pageToken = page?.nextPageToken;
} while (pageToken);
const local = args.email.split('@')[0].replace(/[^a-z]/g, '');
const lookalikes = users
  .map((d) => ({ uid: d.name.split('/').pop(), ...fields(d.fields) }))
  .filter((u) => u.uid !== uid && ((u.email || '').toLowerCase().replace(/[^a-z]/g, '').includes(local) || (displayName && u.displayName === displayName)));
save('lookalike-accounts', lookalikes);
say(lookalikes.length ? lookalikes.map((u) => `  ${u.uid}  ${u.displayName}  ${u.email}`).join('\n') : '  none');

say('\n## Not available, whatever the case');
say('  sign-in history (Auth request logging is off — PICK-04); per-event submit time (PICK-02);');
say('  a save lost on the device before the server acknowledged it (PICK-01).');
writeFileSync(join(outDir, 'summary.txt'), out.join('\n') + '\n');
console.log(`\nRaw evidence and this summary: ${outDir}`);
