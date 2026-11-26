const { HttpsError } = require('firebase-functions/v2/https');

/** The claims a user should carry after a grant or a revoke, leaving every other claim alone. */
const withAdminClaim = (customClaims, admin) => {
  const claims = { ...(customClaims || {}) };
  if (admin) claims.admin = true;
  else delete claims.admin;
  return claims;
};

/**
 * Grants or revokes the admin claim and mirrors it to users/{uid}.isAdmin for display.
 *
 * The claim is written first: if the mirror write then fails, authority is already correct and
 * only the Manage Users badge is stale. A revoked admin keeps a valid ID token for up to an hour;
 * the client refreshes its token as soon as it sees the mirror change.
 */
const setAdminRole = async ({ auth, db }, { actorUid, uid, admin }) => {
  if (typeof uid !== 'string' || !uid || uid.length > 128 || typeof admin !== 'boolean') {
    throw new HttpsError('invalid-argument', 'uid and admin are required.');
  }
  // Otherwise the last admin can lock the league out of every admin tool with one click.
  if (uid === actorUid && !admin) {
    throw new HttpsError('failed-precondition', 'You cannot remove your own admin role.');
  }

  const profileRef = db.collection('users').doc(uid);
  if (!(await profileRef.get()).exists) {
    throw new HttpsError('not-found', 'No member has that id.');
  }
  let account;
  try {
    account = await auth.getUser(uid);
  } catch (error) {
    if (error.code === 'auth/user-not-found') throw new HttpsError('not-found', 'No member has that id.');
    throw error;
  }

  await auth.setCustomUserClaims(uid, withAdminClaim(account.customClaims, admin));
  await profileRef.update({ isAdmin: admin });
  return { uid, admin };
};

module.exports = { setAdminRole, withAdminClaim };
