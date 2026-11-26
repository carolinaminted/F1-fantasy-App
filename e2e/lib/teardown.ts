import { assertThrowaway, inviteCodeFor, runIdFromEmail } from './identities.ts';
import { revokeInvite } from './codes.ts';
import { deleteAuthUser, deleteDoc, lookupUserByEmail, queryDocIds } from './staging-admin.ts';

export async function deleteRunAccount(email: string): Promise<void> {
  assertThrowaway(email);
  // A sign-up that failed before the account existed still leaves these behind.
  await revokeInvite(inviteCodeFor(runIdFromEmail(email)));
  await deleteDoc(`email_verifications/${email.toLowerCase()}`);
  const user = await lookupUserByEmail(email);
  if (!user) return;
  const uid = user.localId;
  for (const code of await queryDocIds('invitation_codes', 'usedBy', uid)) await deleteDoc(`invitation_codes/${code}`);
  await deleteDoc(`userPicks/${uid}`);
  await deleteDoc(`public_users/${uid}`);
  await deleteDoc(`users/${uid}`);
  await deleteAuthUser(uid);
}
