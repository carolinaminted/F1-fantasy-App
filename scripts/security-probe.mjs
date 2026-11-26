#!/usr/bin/env node
//
// Security regression probe for STAGING ([SEC-13]). It attempts every operation a member or an
// anonymous caller must not be able to perform and reports PASS when the attempt is refused.
//
// Usage:
//   scripts/security-probe.mjs [--with-rate-limit] [--json]
//
// It speaks raw HTTP (Identity Toolkit, Firestore REST, the callable protocol) rather than the web
// SDK, because the SDK cannot forge X-Forwarded-For or omit an App Check token.
//
// Pinned to formula-fantasy-staging with no override: these are hostile writes, and there is no
// project where running them by accident would be acceptable.
//
// Identity. With PROBE_MEMBER_EMAIL / PROBE_MEMBER_PASSWORD in .env.probe.local (gitignored) it
// signs in as that non-admin member. Without them it tries to self-register a throwaway account,
// which works only while client sign-up is still open (itself a finding); the account is deleted
// at the end. PROBE_APPCHECK_DEBUG_TOKEN, once App Check is enforced, is exchanged for a token and
// sent on every request except the one that checks a missing token is refused, so a denial is
// always the rule under test and never App Check answering first.
//
// A forbidden write that succeeds is undone straight away. Anything that could not be undone is
// listed under LEFTOVER. Exit code 1 on any FAIL, ERROR or LEFTOVER.

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const STAGING_PROJECT = 'formula-fantasy-staging';
const WEB_ORIGIN = 'https://f1.staging.carolinaminted.net';
const { SEASON_CALLABLES } = createRequire(import.meta.url)('../functions/deploy-targets.js');
const ADMIN_CALLABLES = ['manualLeaderboardSync', ...SEASON_CALLABLES];

const flags = new Set(process.argv.slice(2));
for (const flag of flags) {
  if (!['--with-rate-limit', '--json'].includes(flag)) {
    console.error(`unknown flag ${flag}\nusage: scripts/security-probe.mjs [--with-rate-limit] [--json]`);
    process.exit(2);
  }
}

const parseEnv = (file) => Object.fromEntries(
  readFileSync(file, 'utf8').split('\n')
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^(['"])(.*)\1$/, '$2')]),
);

const env = parseEnv(join(REPO, '.env.staging'));
const PROJECT = env.VITE_FIREBASE_PROJECT_ID;
const API_KEY = env.VITE_FIREBASE_API_KEY;
const APP_ID = env.VITE_FIREBASE_APP_ID;
const FUNCTIONS = env.VITE_PORTAL_FUNCTIONS_BASE_URL;
if (PROJECT !== STAGING_PROJECT || FUNCTIONS !== `https://us-central1-${STAGING_PROJECT}.cloudfunctions.net`) {
  console.error(`Refusing to run: .env.staging points at "${PROJECT}" / "${FUNCTIONS}", not ${STAGING_PROJECT}.`);
  process.exit(2);
}
const localEnvFile = join(REPO, '.env.probe.local');
const local = existsSync(localEnvFile) ? parseEnv(localEnvFile) : {};

const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const IDTK = 'https://identitytoolkit.googleapis.com/v1';
const RUN = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`;
const SYNTHETIC = `zz_probe_${RUN}`;

// ---------------------------------------------------------------------------------------------
// HTTP

let appCheckToken = null;

async function http(url, { method = 'GET', token, body, headers = {}, appCheck = true } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (appCheck && appCheckToken) requestHeaders['X-Firebase-AppCheck'] = appCheckToken;
  const response = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json, headers: response.headers, code: json?.error?.status ?? json?.error?.message ?? '' };
}

// The staging API key may be referrer-restricted ([SEC-14]); an attacker would send this too.
const idtk = (endpoint, body) => http(`${IDTK}/${endpoint}?key=${API_KEY}`, { method: 'POST', body, headers: { Referer: `${WEB_ORIGIN}/` }, appCheck: false });

const encode = (value) => (typeof value === 'boolean' ? { booleanValue: value }
  : Number.isInteger(value) ? { integerValue: String(value) }
    : typeof value === 'number' ? { doubleValue: value }
      : { stringValue: String(value) });
const decode = (value) => (!value ? undefined
  : 'booleanValue' in value ? value.booleanValue
    : 'integerValue' in value ? Number(value.integerValue)
      : 'doubleValue' in value ? value.doubleValue
        : value.stringValue);

const fsGet = (path, token) => http(`${DOCS}/${path}`, { token });
const fsList = (collection, token) => http(`${DOCS}/${collection}?pageSize=1`, { token });
const fsDelete = (path, token) => http(`${DOCS}/${path}`, { method: 'DELETE', token });
const fsAdd = (collection, fields, token) => http(`${DOCS}/${collection}`, {
  method: 'POST', token, body: { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])) },
});
// Always masked: an unmasked PATCH replaces the whole document. A masked field absent from
// `fields` is deleted, which is how a probe field is removed again.
function fsPatch(path, fields, token, { mask = Object.keys(fields), create = false } = {}) {
  const query = new URLSearchParams();
  for (const field of mask) query.append('updateMask.fieldPaths', field);
  if (create) query.set('currentDocument.exists', 'false');
  return http(`${DOCS}/${path}?${query}`, {
    method: 'PATCH', token, body: { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])) },
  });
}

const call = (name, data, options = {}) => http(`${FUNCTIONS}/${name}`, { method: 'POST', body: { data }, ...options });

// ---------------------------------------------------------------------------------------------
// Results

const results = [];
const leftovers = [];
let sequence = 0;

const pass = (detail) => ({ outcome: 'PASS', detail });
const fail = (detail) => ({ outcome: 'FAIL', detail });
const skip = (detail) => ({ outcome: 'SKIP', detail });
const inconclusive = (detail) => ({ outcome: 'ERROR', detail });
const describe = (res) => `HTTP ${res.status}${res.code ? ` ${res.code}` : ''}`;

const refused = (res) => res.status === 401 || res.status === 403;
// A read that the rules allow answers 404 for a document that does not exist.
const readVerdict = (res) => (refused(res) ? pass(describe(res))
  : res.status === 200 || res.status === 404 ? fail(`${describe(res)}: the read was allowed`)
    : inconclusive(describe(res)));
const writeVerdict = (res) => (refused(res) ? pass(describe(res))
  : res.status === 200 ? fail(`${describe(res)}: the write was accepted`)
    : inconclusive(describe(res)));
const controlVerdict = (res) => (res.status === 200 || res.status === 404 ? pass(describe(res))
  : inconclusive(`${describe(res)}: a legitimate request was refused, so denials in this run prove nothing`));

async function check(refs, title, run, { control = false } = {}) {
  const id = control ? 'CTRL' : `P-${String(++sequence).padStart(2, '0')}`;
  let verdict;
  try { verdict = await run(); } catch (error) { verdict = inconclusive(error.message); }
  results.push({ id, refs, title, ...verdict });
  if (!flags.has('--json')) console.log(`${verdict.outcome.padEnd(5)} ${id}  ${title}  [${refs}]  ${verdict.detail}`);
}

async function undo(what, request) {
  try {
    const res = await request();
    if (res.status !== 200) leftovers.push(`${what}: ${describe(res)}`);
  } catch (error) {
    leftovers.push(`${what}: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------------------------
// Cases

async function resolveAppCheck() {
  if (!local.PROBE_APPCHECK_DEBUG_TOKEN) return;
  const res = await http(`https://firebaseappcheck.googleapis.com/v1/projects/${PROJECT}/apps/${APP_ID}:exchangeDebugToken?key=${API_KEY}`, {
    method: 'POST', body: { debug_token: local.PROBE_APPCHECK_DEBUG_TOKEN }, appCheck: false,
  });
  if (res.status !== 200 || !res.json?.token) throw new Error(`App Check debug token exchange failed: ${describe(res)}`);
  appCheckToken = res.json.token;
}

async function resolveIdentity() {
  let throwaway = null;
  await check('SEC-03, SEC-14', 'client sign-up without an invitation is refused', async () => {
    const email = `lol-probe-${RUN}@example.com`;
    const res = await idtk('accounts:signUp', { email, password: randomBytes(18).toString('base64url'), returnSecureToken: true });
    if (res.status === 200 && res.json?.idToken) {
      throwaway = { uid: res.json.localId, token: res.json.idToken, email, throwaway: true };
      return fail('accounts:signUp created an account');
    }
    return res.status === 400 ? pass(describe(res)) : inconclusive(describe(res));
  });

  if (local.PROBE_MEMBER_EMAIL && local.PROBE_MEMBER_PASSWORD) {
    if (throwaway) await deleteAccount(throwaway);
    const res = await idtk('accounts:signInWithPassword', {
      email: local.PROBE_MEMBER_EMAIL, password: local.PROBE_MEMBER_PASSWORD, returnSecureToken: true,
    });
    if (res.status !== 200) throw new Error(`could not sign in as PROBE_MEMBER_EMAIL: ${describe(res)}`);
    return { uid: res.json.localId, token: res.json.idToken, email: local.PROBE_MEMBER_EMAIL, throwaway: false };
  }
  return throwaway;
}

const deleteAccount = (identity) => undo(`auth account ${identity.email} (${identity.uid})`, () => idtk('accounts:delete', { idToken: identity.token }));

async function anonymousCases() {
  await check('H-1, SEC-02', 'anonymous caller cannot list userPicks', async () => readVerdict(await fsList('userPicks')));
  await check('SEC-02', 'anonymous caller cannot list public_users', async () => readVerdict(await fsList('public_users')));
  await check('SEC-02', 'anonymous caller cannot read a users doc', async () => readVerdict(await fsGet(`users/${SYNTHETIC}`)));
  await check('SEC-02', 'anonymous caller cannot read app_state/scoring_config', async () => readVerdict(await fsGet('app_state/scoring_config')));
  await check('SEC-02', 'anonymous caller can read app_state/maintenance', async () => controlVerdict(await fsGet('app_state/maintenance')), { control: true });
}

async function callableCases(member) {
  await check('SEC-01', `admin callables refuse an unauthenticated caller (${ADMIN_CALLABLES.length})`, async () => {
    const open = [];
    for (const name of ADMIN_CALLABLES) {
      const res = await call(name, { seasonId: SYNTHETIC });
      if (res.status >= 500) return inconclusive(`${name}: ${describe(res)}`);
      if (res.code !== 'UNAUTHENTICATED') open.push(`${name}: ${describe(res)}`);
    }
    return open.length ? fail(open.join('; ')) : pass('all answered UNAUTHENTICATED');
  });

  // Only two are called as a member. The guard is the first statement of all six, and these are the
  // two that do no harm if it fails open: a recalculation, and a conclude of a season that does not exist.
  await check('SEC-01', 'admin callables refuse a signed-in non-admin', async () => {
    if (!member) return skip('no member identity');
    const open = [];
    for (const name of ['manualLeaderboardSync', 'concludeSeason']) {
      const res = await call(name, { seasonId: SYNTHETIC }, { token: member.token });
      if (res.status >= 500) return inconclusive(`${name}: ${describe(res)}`);
      if (res.code !== 'PERMISSION_DENIED') open.push(`${name}: ${describe(res)}`);
    }
    return open.length ? fail(open.join('; ')) : pass('both answered PERMISSION_DENIED');
  });

  await check('SEC-06', 'a callable refuses a request with no App Check token', async () => {
    const res = await call('validateInvitationCode', { code: SYNTHETIC }, { appCheck: false });
    if (res.code === 'UNAUTHENTICATED') return pass(describe(res));
    if (res.code === 'RESOURCE_EXHAUSTED') return inconclusive('rate limited before the answer; wait 10 minutes');
    return res.status < 500 ? fail(`${describe(res)}: the function ran`) : inconclusive(describe(res));
  });

  await check('SEC-06', 'a callable does not grant CORS to a foreign origin', async () => {
    const origin = 'https://probe-evil.example';
    const res = await http(`${FUNCTIONS}/validateInvitationCode`, {
      method: 'OPTIONS', appCheck: false,
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization' },
    });
    const granted = res.headers.get('access-control-allow-origin');
    return granted === origin || granted === '*' ? fail(`Access-Control-Allow-Origin: ${granted}`) : pass(`Access-Control-Allow-Origin: ${granted ?? 'absent'}`);
  });

  // Rejected by the address check, before the rate limit and before any mail is sent.
  await check('SEC-05', 'sendPasswordResetLink refuses a list of addresses', async () => {
    const res = await call('sendPasswordResetLink', { email: 'a@example.com, b@example.com' });
    return res.code === 'INVALID_ARGUMENT' ? pass(describe(res)) : res.status < 500 ? fail(describe(res)) : inconclusive(describe(res));
  });

  await check('SEC-05', 'a forged X-Forwarded-For does not reset the per-IP rate limit', async () => {
    if (!flags.has('--with-rate-limit')) return skip('opt in with --with-rate-limit; it locks this IP out of verifyAuthCode on staging for 10 minutes');
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      const res = await call('verifyAuthCode', { email: `lol-probe-${RUN}@example.com`, code: '000000' }, {
        headers: { 'X-Forwarded-For': `198.51.100.${attempt}` },
      });
      if (res.code === 'RESOURCE_EXHAUSTED') return pass(`limited on call ${attempt}`);
      if (res.status !== 200) return inconclusive(describe(res));
    }
    return fail('12 calls with a rotating forged address were all served (limit is 10)');
  });
}

async function emailEnumerationCase(member) {
  await check('S2B-01, SEC-14', 'Identity Toolkit does not reveal whether an email is registered', async () => {
    if (!member) return skip('no known registered email');
    const res = await idtk('accounts:createAuthUri', { identifier: member.email, continueUri: `${WEB_ORIGIN}/` });
    if (res.status !== 200) return inconclusive(describe(res));
    return res.json.registered === true || res.json.signinMethods?.length ? fail('createAuthUri reported the address as registered') : pass('no registration signal');
  });
}

async function memberCases(member) {
  const { uid, token } = member;
  const created = [];
  const syntheticWrite = (refs, title, path) => check(refs, title, async () => {
    const res = await fsPatch(path, { zzProbe: true }, token, { create: true });
    if (res.status === 200) created.push(path);
    return writeVerdict(res);
  });

  const ownUser = await fsGet(`users/${uid}`, token);
  if (decode(ownUser.json?.fields?.isAdmin) === true) throw new Error('the probe account is an admin; use a non-admin member');

  await check('SEC-02', 'member can read their own users doc', async () => controlVerdict(ownUser), { control: true });
  await check('SEC-02', 'member can read app_state/scoring_config', async () => controlVerdict(await fsGet('app_state/scoring_config', token)), { control: true });
  // Pre-lock visibility of rivals' picks to signed-in members is an accepted decision (2026-10-16).
  await check('SEC-02', 'member can list userPicks', async () => controlVerdict(await fsList('userPicks', token)), { control: true });

  await check('SEC-02', "member cannot read another member's users doc", async () => readVerdict(await fsGet(`users/${SYNTHETIC}`, token)));
  for (const collection of ['email_verifications', 'rate_limits', 'rate_limits_ip', 'invitation_codes', 'admin_logs', 'season_ops']) {
    await check('SEC-08', `member cannot list ${collection}`, async () => readVerdict(await fsList(collection, token)));
  }

  await syntheticWrite('SEC-02', 'member cannot write app_state', `app_state/${SYNTHETIC}`);
  await syntheticWrite('SEC-02', 'member cannot write season_config', `season_config/${SYNTHETIC}`);
  await syntheticWrite('SEC-02', 'member cannot write season_archives', `season_archives/${SYNTHETIC}`);
  await syntheticWrite('SEC-02', 'member cannot write career_stats', `career_stats/${SYNTHETIC}`);
  await syntheticWrite('SEC-02', "member cannot write another member's userPicks", `userPicks/${SYNTHETIC}`);
  await syntheticWrite('SEC-08', 'member cannot write invitation_codes', `invitation_codes/${SYNTHETIC}`);
  await check('SEC-08, SEC-09', 'member cannot add an admin_logs row', async () => {
    const res = await fsAdd('admin_logs', { action: 'zz-probe', zzProbe: true }, token);
    if (res.status === 200) created.push(res.json.name.split('/documents/')[1]);
    return writeVerdict(res);
  });

  await check('C-1, SEC-02', 'member cannot write their own userPicks directly', async () => {
    const path = `userPicks/${uid}`;
    const existed = (await fsGet(path, token)).status === 200;
    const res = await fsPatch(path, { zzProbe: true }, token, { create: !existed });
    if (res.status === 200) {
      await undo(`${path} probe field`, () => (existed ? fsPatch(path, {}, token, { mask: ['zzProbe'] }) : fsDelete(path, token)));
    }
    return writeVerdict(res);
  });

  await check('SEC-02', 'member cannot set their own points on public_users', async () => {
    const path = `public_users/${uid}`;
    const current = await fsGet(path, token);
    if (current.status === 200) {
      const points = decode(current.json.fields?.totalPoints);
      const res = await fsPatch(path, { totalPoints: (points ?? 0) + 1 }, token);
      if (res.status === 200) {
        await undo(`${path} totalPoints`, () => fsPatch(path, points === undefined ? {} : { totalPoints: points }, token, { mask: ['totalPoints'] }));
      }
      return writeVerdict(res);
    }
    const res = await fsPatch(path, { displayName: 'zz-probe', totalPoints: 1, rank: 1 }, token, { create: true });
    if (res.status === 200) created.push(path);
    return writeVerdict(res);
  });

  // The two users-doc cases run last: the second one makes the probe account an admin if it works,
  // and nothing else may run with that authority except the clean-up.
  let userDocExists = ownUser.status === 200;
  let createdUserDoc = false;
  const before = ownUser.json?.fields ?? {};
  const restore = (field) => undo(`users/${uid} ${field}`, () => fsPatch(
    `users/${uid}`, field in before ? { [field]: decode(before[field]) } : {}, token, { mask: [field] },
  ));

  await check('SEC-02', 'member cannot change their own dues status', async () => {
    const forged = decode(before.duesPaidStatus) === 'Paid' ? 'Unpaid' : 'Paid';
    const res = userDocExists
      ? await fsPatch(`users/${uid}`, { duesPaidStatus: forged }, token)
      : await fsPatch(`users/${uid}`, { displayName: 'zz-probe', duesPaidStatus: forged }, token, { create: true });
    if (res.status === 200 && userDocExists) await restore('duesPaidStatus');
    if (res.status === 200 && !userDocExists) { userDocExists = true; createdUserDoc = true; }
    return writeVerdict(res);
  });

  let escalated = false;
  await check('SEC-01, SEC-02', 'member cannot make themselves an admin', async () => {
    const res = userDocExists
      ? await fsPatch(`users/${uid}`, { isAdmin: true }, token)
      : await fsPatch(`users/${uid}`, { displayName: 'zz-probe', isAdmin: true }, token, { create: true });
    if (res.status === 200) {
      escalated = true;
      if (!userDocExists) { userDocExists = true; createdUserDoc = true; }
    }
    return writeVerdict(res);
  });

  // Documents the probe created can only be deleted by an admin, which the probe is only if the
  // escalation above worked. The admin flag itself is removed last.
  for (const path of created) await undo(path, () => fsDelete(path, token));
  if (createdUserDoc) await undo(`users/${uid}`, () => fsDelete(`users/${uid}`, token));
  else if (escalated) await restore('isAdmin');
}

async function headerCase() {
  await check('SEC-07', 'the web app sends its security headers', async () => {
    const res = await http(`${WEB_ORIGIN}/`, { appCheck: false });
    if (res.status !== 200) return inconclusive(describe(res));
    const header = (name) => res.headers.get(name) ?? '';
    const missing = ['content-security-policy', 'strict-transport-security', 'referrer-policy', 'permissions-policy', 'x-content-type-options']
      .filter((name) => !header(name));
    if (!header('x-frame-options') && !/frame-ancestors/.test(header('content-security-policy'))) missing.push('framing protection');
    if (/\d/.test(header('server'))) missing.push(`server version hidden (got "${header('server')}")`);
    return missing.length ? fail(`missing: ${missing.join(', ')}`) : pass('all present');
  });
}

// ---------------------------------------------------------------------------------------------

let member = null;
try {
  await resolveAppCheck();
  member = await resolveIdentity();
  await anonymousCases();
  await emailEnumerationCase(member);
  await callableCases(member);
  await headerCase();
  if (member) await memberCases(member);
  else results.push({ id: 'P-xx', refs: 'SEC-13', title: 'member cases', ...skip('no identity: set PROBE_MEMBER_EMAIL and PROBE_MEMBER_PASSWORD in .env.probe.local') });
} catch (error) {
  results.push({ id: 'RUN', refs: 'SEC-13', title: 'probe run', ...inconclusive(error.message) });
  if (!flags.has('--json')) console.log(`ERROR RUN  ${error.message}`);
} finally {
  if (member?.throwaway) await deleteAccount(member);
}

const count = (outcome) => results.filter((result) => result.outcome === outcome).length;
const summary = { project: PROJECT, run: RUN, identity: member ? (member.throwaway ? 'throwaway' : 'member') : 'none', pass: count('PASS'), fail: count('FAIL'), skip: count('SKIP'), error: count('ERROR'), leftovers };
if (flags.has('--json')) {
  console.log(JSON.stringify({ ...summary, results }, null, 2));
} else {
  for (const leftover of leftovers) console.log(`LEFTOVER  ${leftover}`);
  console.log(`\n${PROJECT}, identity ${summary.identity}: ${summary.pass} pass, ${summary.fail} fail, ${summary.skip} skip, ${summary.error} error, ${leftovers.length} leftover`);
}
process.exit(summary.fail || summary.error || leftovers.length ? 1 : 0);
