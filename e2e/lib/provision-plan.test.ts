import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planProvision, type Observed } from './provision-plan.ts';

const blank = (role: 'admin' | 'member'): Observed => ({ role, email: `${role}@x`, authUser: null, userDoc: null, publicDoc: null, hasPassword: false });

test('fresh staging: create everything, admin gets flag and claim', () => {
  const kinds = planProvision([blank('admin'), blank('member')]).map((a) => `${a.role}:${a.kind}`);
  assert.deepEqual(kinds, [
    'admin:createAuth', 'admin:createUserDoc', 'admin:createPublicDoc', 'admin:setIsAdmin', 'admin:setAdminClaim',
    'member:createAuth', 'member:createUserDoc', 'member:createPublicDoc',
  ]);
});

test('fully provisioned: nothing to do', () => {
  const done = (role: 'admin' | 'member'): Observed => ({
    role, email: `${role}@x`, hasPassword: true, publicDoc: { displayName: 'x' },
    authUser: { localId: role, customAttributes: role === 'admin' ? '{"admin":true}' : undefined },
    userDoc: role === 'admin' ? { isAdmin: true } : { duesPaidStatus: 'Unpaid' },
  });
  assert.deepEqual(planProvision([done('admin'), done('member')]), []);
});

test('account exists but .env.e2e lost its password: rotate it', () => {
  const o: Observed = { ...blank('member'), authUser: { localId: 'm' }, userDoc: {}, publicDoc: {}, hasPassword: false };
  assert.deepEqual(planProvision([o]).map((a) => a.kind), ['setPassword']);
});

test('admin missing only the claim: set the claim', () => {
  const o: Observed = { ...blank('admin'), authUser: { localId: 'a', customAttributes: '{}' }, userDoc: { isAdmin: true }, publicDoc: {}, hasPassword: true };
  assert.deepEqual(planProvision([o]).map((a) => a.kind), ['setAdminClaim']);
});
