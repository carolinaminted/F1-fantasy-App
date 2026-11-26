const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAuth, requireAdmin, logAdminActionServer } = require('../auth-guards');
const { setAdminRole, withAdminClaim } = require('../admin-role');
const { parseArguments, planClaims, resolveGrants } = require('../scripts/bootstrap-admin-claims');

const quietLogger = () => {
  const warnings = [];
  return { warnings, warn: (message, fields) => warnings.push({ message, fields }) };
};
const hasCode = (code) => (error) => error.code === code;

const fakeAuth = (users) => ({
  users,
  getUser: async (uid) => {
    if (!users[uid]) throw Object.assign(new Error('missing'), { code: 'auth/user-not-found' });
    return { uid, customClaims: users[uid].customClaims };
  },
  setCustomUserClaims: async (uid, claims) => { users[uid].customClaims = claims; },
});
const fakeDb = (docs) => ({
  docs,
  collection: (name) => ({
    doc: (id) => ({
      get: async () => ({ exists: `${name}/${id}` in docs }),
      update: async (data) => { Object.assign(docs[`${name}/${id}`], data); },
    }),
    add: async (data) => { docs[`${name}/auto${Object.keys(docs).length}`] = data; },
  }),
});

test('requireAuth refuses a caller with no token', () => {
  assert.throws(() => requireAuth({}), hasCode('unauthenticated'));
});

test('requireAdmin accepts only the admin claim', () => {
  const logger = quietLogger();
  const admin = { auth: { uid: 'a', token: { admin: true } } };
  assert.equal(requireAdmin(admin, 'sync', logger).uid, 'a');
  assert.deepEqual(logger.warnings, []);
});

test('requireAdmin refuses a member and logs a structured event', () => {
  const logger = quietLogger();
  assert.throws(() => requireAdmin({ auth: { uid: 'm', token: {} } }, 'sync', logger), hasCode('permission-denied'));
  assert.deepEqual(logger.warnings, [{
    message: 'unauthorized_admin_attempt',
    fields: { event: 'unauthorized_admin_attempt', action: 'sync', uid: 'm' },
  }]);
});

test('requireAdmin refuses a truthy claim that is not exactly true', () => {
  ['true', 1, {}].forEach((value) => {
    assert.throws(() => requireAdmin({ auth: { uid: 'm', token: { admin: value } } }, 'sync', quietLogger()), hasCode('permission-denied'));
  });
});

test('requireAdmin refuses an unauthenticated caller before looking for a claim', () => {
  assert.throws(() => requireAdmin({}, 'sync', quietLogger()), hasCode('unauthenticated'));
});

test('withAdminClaim keeps every other claim', () => {
  assert.deepEqual(withAdminClaim({ beta: true }, true), { beta: true, admin: true });
  assert.deepEqual(withAdminClaim({ beta: true, admin: true }, false), { beta: true });
  assert.deepEqual(withAdminClaim(undefined, false), {});
});

test('setAdminRole grants the claim and mirrors it', async () => {
  const auth = fakeAuth({ m: { customClaims: { beta: true } } });
  const db = fakeDb({ 'users/m': { displayName: 'M' } });
  assert.deepEqual(await setAdminRole({ auth, db }, { actorUid: 'a', uid: 'm', admin: true }), { uid: 'm', admin: true });
  assert.deepEqual(auth.users.m.customClaims, { beta: true, admin: true });
  assert.equal(db.docs['users/m'].isAdmin, true);
});

test('setAdminRole revokes the claim and mirrors it', async () => {
  const auth = fakeAuth({ m: { customClaims: { admin: true } } });
  const db = fakeDb({ 'users/m': { isAdmin: true } });
  await setAdminRole({ auth, db }, { actorUid: 'a', uid: 'm', admin: false });
  assert.deepEqual(auth.users.m.customClaims, {});
  assert.equal(db.docs['users/m'].isAdmin, false);
});

test('setAdminRole will not let an admin revoke themselves', async () => {
  const auth = fakeAuth({ a: { customClaims: { admin: true } } });
  const db = fakeDb({ 'users/a': { isAdmin: true } });
  await assert.rejects(setAdminRole({ auth, db }, { actorUid: 'a', uid: 'a', admin: false }), hasCode('failed-precondition'));
  assert.deepEqual(auth.users.a.customClaims, { admin: true });
});

test('setAdminRole refuses malformed input', async () => {
  const deps = { auth: fakeAuth({}), db: fakeDb({}) };
  for (const input of [{ uid: '', admin: true }, { uid: 'm', admin: 'true' }, { uid: 5, admin: true }, { uid: 'x'.repeat(129), admin: true }, {}]) {
    await assert.rejects(setAdminRole(deps, { actorUid: 'a', ...input }), hasCode('invalid-argument'));
  }
});

test('setAdminRole reports a missing profile or account as not-found and changes nothing', async () => {
  const noProfile = { auth: fakeAuth({ m: {} }), db: fakeDb({}) };
  await assert.rejects(setAdminRole(noProfile, { actorUid: 'a', uid: 'm', admin: true }), hasCode('not-found'));
  assert.equal(noProfile.auth.users.m.customClaims, undefined);

  const noAccount = { auth: fakeAuth({}), db: fakeDb({ 'users/m': {} }) };
  await assert.rejects(setAdminRole(noAccount, { actorUid: 'a', uid: 'm', admin: true }), hasCode('not-found'));
  assert.equal(noAccount.db.docs['users/m'].isAdmin, undefined);
});

test('logAdminActionServer names the actor from the token', async () => {
  const db = fakeDb({});
  const FieldValue = { serverTimestamp: () => 'NOW' };
  await logAdminActionServer(db, FieldValue, { uid: 'a', token: { email: 'a@example.com' } }, { action: 'set_admin_role', changes: 'granted m' });
  assert.deepEqual(Object.values(db.docs), [{
    adminId: 'a', adminName: 'a@example.com', action: 'set_admin_role', changes: 'granted m', source: 'server', timestamp: 'NOW',
  }]);
});

test('bootstrap: plans candidates, existing claims, missing accounts and stray claims', () => {
  const flagged = [{ uid: 'a' }, { uid: 'b' }, { uid: 'gone' }];
  const accounts = new Map([['a', {}], ['b', {}], ['stray', {}]]);
  const plan = planClaims(flagged, accounts, new Set(['b', 'stray']));
  assert.deepEqual(plan.candidates.map((u) => u.uid), ['a']);
  assert.deepEqual(plan.alreadyClaimed.map((u) => u.uid), ['b']);
  assert.deepEqual(plan.noAccount.map((u) => u.uid), ['gone']);
  assert.deepEqual(plan.claimWithoutFlag, ['stray']);
});

test('bootstrap: grants only uids the dry run offered', () => {
  const plan = planClaims([{ uid: 'a' }], new Map([['a', {}], ['m', {}]]), new Set());
  assert.deepEqual(resolveGrants(plan, ['a']), ['a']);
  assert.throws(() => resolveGrants(plan, ['a', 'm']), /Not a candidate.*m/);
});

test('bootstrap: --apply must name who is granted, and nothing else is accepted', () => {
  assert.deepEqual(parseArguments([]), { apply: false, grant: [] });
  assert.deepEqual(parseArguments(['--apply', '--grant', 'a, b']), { apply: true, grant: ['a', 'b'] });
  assert.throws(() => parseArguments(['--apply']), /needs --grant/);
  assert.throws(() => parseArguments(['--grant', 'a']), /only makes sense with --apply/);
  assert.throws(() => parseArguments(['--project', 'formula-fantasy-1']), /Unsupported argument/);
});
