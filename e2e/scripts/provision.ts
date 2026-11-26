import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { ADMIN_EMAIL, MEMBER_EMAIL } from '../lib/identities.ts';
import { findEnvFile, parseEnv, upsertEnvFile } from '../lib/env.ts';
import { planProvision, type Observed, type Role } from '../lib/provision-plan.ts';
import { createAuthUser, createDoc, getDoc, lookupUserByEmail, patchDoc, updateAuthUser } from '../lib/staging-admin.ts';

const apply = process.argv.includes('--apply');
const ROLES: Record<Role, { email: string; displayName: string; first: string; envEmail: string; envPassword: string }> = {
  admin: { email: ADMIN_EMAIL, displayName: 'E2E Admin', first: 'E2E', envEmail: 'E2E_ADMIN_EMAIL', envPassword: 'E2E_ADMIN_PASSWORD' },
  member: { email: MEMBER_EMAIL, displayName: 'E2E Member', first: 'E2E', envEmail: 'E2E_MEMBER_EMAIL', envPassword: 'E2E_MEMBER_PASSWORD' },
};

const envFile = findEnvFile();
const env = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};

const observed: Observed[] = [];
for (const role of ['admin', 'member'] as Role[]) {
  const r = ROLES[role];
  const authUser = await lookupUserByEmail(r.email);
  observed.push({
    role, email: r.email, authUser,
    userDoc: authUser ? await getDoc(`users/${authUser.localId}`) : null,
    publicDoc: authUser ? await getDoc(`public_users/${authUser.localId}`) : null,
    hasPassword: Boolean(env[r.envPassword]),
  });
}

const actions = planProvision(observed);
console.log(`env file: ${envFile}`);
console.log(actions.length ? actions.map((a) => `  ${a.role}: ${a.kind}`).join('\n') : '  nothing to do');
if (!apply) { console.log('dry run; pass --apply to write to formula-fantasy-staging'); process.exit(0); }

const uids: Partial<Record<Role, string>> = Object.fromEntries(observed.filter((o) => o.authUser).map((o) => [o.role, o.authUser!.localId]));
for (const a of actions) {
  const r = ROLES[a.role];
  if (a.kind === 'createAuth' || a.kind === 'setPassword') {
    const password = randomBytes(18).toString('base64url');
    if (a.kind === 'createAuth') uids[a.role] = await createAuthUser({ email: r.email, password, displayName: r.displayName });
    else await updateAuthUser(uids[a.role]!, { password });
    upsertEnvFile(envFile, { [r.envEmail]: r.email, [r.envPassword]: password });
  }
  const uid = uids[a.role]!;
  if (a.kind === 'createUserDoc') await createDoc(`users/${uid}`, { displayName: r.displayName, email: r.email, firstName: r.first, lastName: a.role === 'admin' ? 'Admin' : 'Member', duesPaidStatus: 'Unpaid', createdAt: new Date() });
  if (a.kind === 'createPublicDoc') await createDoc(`public_users/${uid}`, { displayName: r.displayName, totalPoints: 0, rank: 999, breakdown: { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 } });
  if (a.kind === 'setIsAdmin') await patchDoc(`users/${uid}`, { isAdmin: true });
  if (a.kind === 'setAdminClaim') await updateAuthUser(uid, { customClaims: { admin: true } });
  console.log(`  done ${a.role}: ${a.kind}`);
}
