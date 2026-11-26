const { HttpsError } = require('firebase-functions/v2/https');

const requireAuth = (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Login required.');
  }
  return request.auth;
};

/**
 * Admin authority is the `admin` custom claim on the caller's ID token. Only the Admin SDK can
 * mint it (setAdminRole, or scripts/bootstrap-admin-claims.js), whereas users/{uid}.isAdmin, which
 * this used to read, sits in a document its owner can write. That field is now a display mirror.
 */
const requireAdmin = (request, action, logger) => {
  const auth = requireAuth(request);
  if (auth.token?.admin !== true) {
    // Structured so a log-based alert can key on `event` ([SEC-10]).
    logger.warn('unauthorized_admin_attempt', { event: 'unauthorized_admin_attempt', action, uid: auth.uid });
    throw new HttpsError('permission-denied', 'Only admins can do this.');
  }
  return auth;
};

/**
 * An admin_logs row written by the server, so the actor comes from the verified token rather than
 * from whatever name a browser chose to send. Shaped like the client's rows so the log viewer,
 * which orders by `timestamp`, shows both.
 */
const logAdminActionServer = (db, FieldValue, auth, { action, changes }) => db.collection('admin_logs').add({
  adminId: auth.uid,
  adminName: auth.token?.name || auth.token?.email || auth.uid,
  action,
  changes,
  source: 'server',
  timestamp: FieldValue.serverTimestamp(),
});

module.exports = { requireAuth, requireAdmin, logAdminActionServer };
