const http = require('node:http');
const { randomInt } = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldPath, FieldValue, getFirestore, Timestamp } = require('firebase-admin/firestore');
const nodemailer = require('nodemailer');
const { recalculateEntireLeague } = require('./scoring');

const port = Number.parseInt(process.env.PORT || '8080', 10);
const appEnvironment = process.env.APP_ENV;
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const allowedTargets = {
  staging: 'formula-fantasy-staging',
  production: 'formula-fantasy-1',
};

if (!Object.hasOwn(allowedTargets, appEnvironment)) {
  throw new Error('APP_ENV must be explicitly set to staging or production.');
}

if (allowedTargets[appEnvironment] !== firebaseProjectId) {
  throw new Error(
    `Firebase target mismatch: ${appEnvironment} must use ${allowedTargets[appEnvironment]}.`,
  );
}

initializeApp({ projectId: firebaseProjectId });
const db = getFirestore();

const corsHeaders = (request) => {
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'Authorization, Content-Type',
    'access-control-max-age': '3600',
    vary: 'Origin',
  };
};

const sendJson = (request, response, statusCode, body, extraHeaders = {}) => {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...corsHeaders(request),
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
};

const getClientIp = (request) => {
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.socket?.remoteAddress || 'unknown';
};

const checkRateLimit = async (ip, operation, limit, windowSeconds) => {
  const safeIp = ip.replace(/[^a-zA-Z0-9]/g, '_');
  const documentRef = db.collection('rate_limits_ip').doc(`${operation}_${safeIp}`);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentRef);
    const now = Timestamp.now();
    const data = snapshot.exists ? snapshot.data() : null;

    if (!data || !data.resetTime || now.seconds > data.resetTime.seconds) {
      transaction.set(documentRef, {
        count: 1,
        resetTime: new Timestamp(now.seconds + windowSeconds, 0),
      });
      return;
    }

    if (data.count >= limit) {
      const error = new Error(
        `Too many attempts. Please try again in ${Math.ceil(
          (data.resetTime.seconds - now.seconds) / 60,
        )} minutes.`,
      );
      error.statusCode = 429;
      error.code = 'rate_limited';
      throw error;
    }

    transaction.update(documentRef, { count: data.count + 1 });
  });
};

const requireAdmin = async (request) => {
  const authorization = request.headers.authorization || '';
  const match = authorization.match(/^Bearer (.+)$/i);
  if (!match) {
    const error = new Error('Login required.');
    error.statusCode = 401;
    error.code = 'unauthenticated';
    throw error;
  }

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(match[1]);
  } catch (cause) {
    const error = new Error('Your session is invalid or expired. Please sign in again.');
    error.statusCode = 401;
    error.code = 'invalid_token';
    error.cause = cause;
    throw error;
  }

  const userSnapshot = await db.collection('users').doc(decodedToken.uid).get();
  if (!userSnapshot.exists || userSnapshot.data().isAdmin !== true) {
    const error = new Error('Only admins can trigger a league sync.');
    error.statusCode = 403;
    error.code = 'permission_denied';
    throw error;
  }

  return decodedToken.uid;
};

const readJsonBody = async (request, maximumBytes = 64 * 1024) => {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maximumBytes) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      error.code = 'payload_too_large';
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch (cause) {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    error.code = 'invalid_json';
    error.cause = cause;
    throw error;
  }
};

const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const publicAuthPaths = new Set([
  '/v1/auth/invitations/validate',
  '/v1/auth/email-code/send',
  '/v1/auth/email-code/verify',
  '/v1/auth/password-reset',
]);

const requireAllowedOrigin = (request) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) return;

  const error = new Error('Request origin is not allowed.');
  error.statusCode = 403;
  error.code = 'origin_not_allowed';
  throw error;
};

const normalizeEmail = (value) => {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (
    email.length === 0
    || email.length > 254
    || !/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)
  ) {
    const error = new Error('A valid email address is required.');
    error.statusCode = 400;
    error.code = 'invalid_email';
    throw error;
  }
  return email;
};

const readSingleFieldBody = async (request, fieldName) => {
  const body = await readJsonBody(request);
  if (!isPlainObject(body) || Object.keys(body).some((field) => field !== fieldName)) {
    const error = new Error(`Request must contain only ${fieldName}.`);
    error.statusCode = 400;
    error.code = 'invalid_request';
    throw error;
  }
  return body[fieldName];
};

const getEmailTransport = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_PASS;
  if (
    !emailUser
    || emailUser === 'your-email@gmail.com'
    || !emailPassword
    || emailPassword === 'your-app-password'
  ) {
    const error = new Error('Email service is not configured.');
    error.statusCode = 503;
    error.code = 'email_not_configured';
    throw error;
  }
  return {
    emailUser,
    transporter: nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPassword },
    }),
  };
};

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const emailShell = (content) => `
  <div style="background-color:#0A0A0A;color:#F5F5F5;font-family:Arial,sans-serif;padding:40px;text-align:center;border-radius:12px;max-width:600px;margin:0 auto;border:1px solid #2C2C2C">
    <div style="margin-bottom:40px">
      <div style="font-size:36px;font-weight:900;font-style:italic;line-height:1;letter-spacing:-1px;margin-bottom:5px">
        <span style="color:#DA291C">LIGHTS</span> <span style="color:#FFFFFF">OUT</span>
      </div>
      <div style="font-size:14px;letter-spacing:.4em;color:#FFFFFF">LEAGUE</div>
    </div>
    ${content}
  </div>
`;

const verificationEmailHtml = (code) => emailShell(`
  <div style="margin-bottom:25px;font-size:16px;color:#C0C0C0">Your verification code is:</div>
  <div style="background-color:#1a1a1a;color:#FFFFFF;font-size:42px;font-weight:bold;letter-spacing:8px;padding:25px;border-radius:8px;border:1px solid #DA291C;display:inline-block;margin-bottom:30px">${escapeHtml(code)}</div>
  <div style="font-size:12px;color:#666666;margin-top:20px;border-top:1px solid #333333;padding-top:20px">
    This code expires in 10 minutes.<br>If you did not request this, please ignore this email.
  </div>
`);

const passwordResetEmailHtml = (email, resetLink) => emailShell(`
  <div style="margin-bottom:10px;font-size:18px;font-weight:bold;color:#FFFFFF">Password Reset Request</div>
  <div style="margin-bottom:25px;font-size:14px;color:#C0C0C0">
    We received a request to reset the password for<br>
    <span style="color:#FFFFFF;font-weight:bold">${escapeHtml(email)}</span>
  </div>
  <div style="margin-bottom:30px">
    <a href="${escapeHtml(resetLink)}" style="background-color:#DA291C;color:#FFFFFF;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 40px;border-radius:8px;display:inline-block;letter-spacing:1px">RESET PASSWORD</a>
  </div>
  <div style="font-size:12px;color:#666666;margin-bottom:15px">This link expires in 1 hour.</div>
  <div style="font-size:12px;color:#666666;border-top:1px solid #333333;padding-top:20px">
    If you did not request a password reset, you can safely ignore this email.<br>Your password will remain unchanged.
  </div>
`);

const isIdentifier = (value) => (
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
);

const validateDriverList = (value, fieldName) => {
  if (!Array.isArray(value) || value.length > 30) {
    throw Object.assign(new Error(`${fieldName} must be an array with at most 30 entries.`), {
      statusCode: 400,
      code: 'invalid_results',
    });
  }
  if (!value.every((entry) => entry === null || isIdentifier(entry))) {
    throw Object.assign(new Error(`${fieldName} contains an invalid driver identifier.`), {
      statusCode: 400,
      code: 'invalid_results',
    });
  }
};

const validatePointsSystem = (value) => {
  if (!isPlainObject(value)) return false;
  const arrayFields = [
    'grandPrixFinish',
    'sprintFinish',
    'gpQualifying',
    'sprintQualifying',
  ];
  if (!arrayFields.every((field) => (
    Array.isArray(value[field])
      && value[field].length <= 30
      && value[field].every((point) => Number.isFinite(point) && point >= 0)
  ))) return false;
  return Number.isFinite(value.fastestLap) && value.fastestLap >= 0;
};

const validateEventResult = (value) => {
  if (!isPlainObject(value)) {
    throw Object.assign(new Error('results must be an object.'), {
      statusCode: 400,
      code: 'invalid_results',
    });
  }

  const allowedFields = new Set([
    'grandPrixFinish',
    'sprintFinish',
    'gpQualifying',
    'sprintQualifying',
    'fastestLap',
    'p22Driver',
    'driverTeams',
    'scoringSnapshot',
  ]);
  if (!Object.keys(value).every((field) => allowedFields.has(field))) {
    throw Object.assign(new Error('results contains an unsupported field.'), {
      statusCode: 400,
      code: 'invalid_results',
    });
  }

  ['grandPrixFinish', 'sprintFinish', 'gpQualifying', 'sprintQualifying']
    .filter((field) => value[field] !== undefined)
    .forEach((field) => validateDriverList(value[field], field));

  for (const field of ['fastestLap', 'p22Driver']) {
    if (value[field] !== undefined && value[field] !== null && !isIdentifier(value[field])) {
      throw Object.assign(new Error(`${field} contains an invalid driver identifier.`), {
        statusCode: 400,
        code: 'invalid_results',
      });
    }
  }

  if (value.driverTeams !== undefined) {
    const entries = isPlainObject(value.driverTeams) ? Object.entries(value.driverTeams) : [];
    if (
      !isPlainObject(value.driverTeams)
      || entries.length > 100
      || !entries.every(([driverId, constructorId]) => (
        isIdentifier(driverId) && isIdentifier(constructorId)
      ))
    ) {
      throw Object.assign(new Error('driverTeams contains invalid identifiers.'), {
        statusCode: 400,
        code: 'invalid_results',
      });
    }
  }

  if (value.scoringSnapshot !== undefined && !validatePointsSystem(value.scoringSnapshot)) {
    throw Object.assign(new Error('scoringSnapshot is invalid.'), {
      statusCode: 400,
      code: 'invalid_results',
    });
  }

  return value;
};

const sendCommandError = (request, response, error, operation) => {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const code = statusCode === 500 ? 'internal' : error.code;
  const message = statusCode === 500 ? 'Command failed on the server.' : error.message;
  console.error(
    JSON.stringify({
      message: `${operation} failed`,
      code: error.code || 'internal',
      detail: error.cause?.code || error.message,
    }),
  );
  sendJson(request, response, statusCode, {
    success: false,
    error: { code, message },
  });
};

const handleManualLeaderboardSync = async (request, response) => {
  const origin = request.headers.origin;
  if (origin && !allowedOrigins.has(origin)) {
    sendJson(request, response, 403, {
      success: false,
      error: { code: 'origin_not_allowed', message: 'Request origin is not allowed.' },
    });
    return;
  }

  try {
    const uid = await requireAdmin(request);
    await checkRateLimit(getClientIp(request), 'manual_sync_api', 5, 300);
    const usersProcessed = await recalculateEntireLeague(db);
    console.info(JSON.stringify({ message: 'Manual leaderboard sync succeeded', uid }));
    sendJson(request, response, 200, { success: true, usersProcessed });
  } catch (error) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    const code = statusCode === 500 ? 'internal' : error.code;
    const message = statusCode === 500
      ? 'Recalculation failed on the server.'
      : error.message;
    console.error(
      JSON.stringify({
        message: 'Manual leaderboard sync failed',
        code: error.code || 'internal',
        detail: error.cause?.code || error.message,
      }),
    );
    sendJson(request, response, statusCode, {
      success: false,
      error: { code, message },
    });
  }
};

const handleSaveRaceResults = async (request, response, eventId) => {
  try {
    const uid = await requireAdmin(request);
    await checkRateLimit(getClientIp(request), 'admin_results_api', 30, 300);
    const body = await readJsonBody(request);
    if (!isPlainObject(body) || Object.keys(body).some((field) => field !== 'results')) {
      throw Object.assign(new Error('Request must contain only a results object.'), {
        statusCode: 400,
        code: 'invalid_request',
      });
    }
    const results = validateEventResult(body.results);

    await db.collection('app_state').doc('race_results').set({ [eventId]: results }, { merge: true });
    const usersProcessed = await recalculateEntireLeague(db);
    console.info(
      JSON.stringify({
        message: 'Race results command succeeded',
        uid,
        eventId,
        usersProcessed,
      }),
    );
    sendJson(request, response, 200, { success: true, eventId, usersProcessed });
  } catch (error) {
    sendCommandError(request, response, error, 'Race results command');
  }
};

const handleCancelEvent = async (request, response, eventId) => {
  try {
    const uid = await requireAdmin(request);
    await checkRateLimit(getClientIp(request), 'admin_cancellation_api', 30, 300);
    const body = await readJsonBody(request);
    if (!isPlainObject(body) || Object.keys(body).some((field) => field !== 'reason')) {
      throw Object.assign(new Error('Request may contain only a cancellation reason.'), {
        statusCode: 400,
        code: 'invalid_request',
      });
    }
    if (body.reason !== undefined && body.reason !== null && typeof body.reason !== 'string') {
      throw Object.assign(new Error('Cancellation reason must be text.'), {
        statusCode: 400,
        code: 'invalid_request',
      });
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length > 500) {
      throw Object.assign(new Error('Cancellation reason must be 500 characters or fewer.'), {
        statusCode: 400,
        code: 'invalid_request',
      });
    }

    const documentRef = db.collection('app_state').doc('cancelled_events');
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(documentRef);
      const existingEvents = snapshot.exists && isPlainObject(snapshot.data().events)
        ? snapshot.data().events
        : {};
      transaction.set(
        documentRef,
        {
          events: {
            ...existingEvents,
            [eventId]: {
              cancelledAt: FieldValue.serverTimestamp(),
              cancelledBy: uid,
              reason: reason || null,
            },
          },
        },
        { merge: true },
      );
    });
    const usersProcessed = await recalculateEntireLeague(db);
    console.info(
      JSON.stringify({
        message: 'Event cancellation command succeeded',
        uid,
        eventId,
        usersProcessed,
      }),
    );
    sendJson(request, response, 200, { success: true, eventId, usersProcessed });
  } catch (error) {
    sendCommandError(request, response, error, 'Event cancellation command');
  }
};

const handleRestoreEvent = async (request, response, eventId) => {
  try {
    const uid = await requireAdmin(request);
    await checkRateLimit(getClientIp(request), 'admin_cancellation_api', 30, 300);
    await db.collection('app_state').doc('cancelled_events').update(
      new FieldPath('events', eventId),
      FieldValue.delete(),
    );
    const usersProcessed = await recalculateEntireLeague(db);
    console.info(
      JSON.stringify({
        message: 'Event restoration command succeeded',
        uid,
        eventId,
        usersProcessed,
      }),
    );
    sendJson(request, response, 200, { success: true, eventId, usersProcessed });
  } catch (error) {
    sendCommandError(request, response, error, 'Event restoration command');
  }
};

const handleValidateInvitation = async (request, response) => {
  try {
    requireAllowedOrigin(request);
    await checkRateLimit(getClientIp(request), 'validate_invitation_api', 5, 600);
    const rawCode = await readSingleFieldBody(request, 'code');
    const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    if (!/^LOL-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      throw Object.assign(new Error('Invalid invitation code.'), {
        statusCode: 404,
        code: 'invalid_invitation',
      });
    }

    const codeRef = db.collection('invitation_codes').doc(code);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(codeRef);
      if (!snapshot.exists) {
        throw Object.assign(new Error('Invalid invitation code.'), {
          statusCode: 404,
          code: 'invalid_invitation',
        });
      }
      if (snapshot.data().status !== 'active') {
        throw Object.assign(new Error('Invitation code has already been used.'), {
          statusCode: 409,
          code: 'invitation_unavailable',
        });
      }
      transaction.update(codeRef, {
        status: 'reserved',
        reservedAt: FieldValue.serverTimestamp(),
      });
    });

    sendJson(request, response, 200, { valid: true });
  } catch (error) {
    sendCommandError(request, response, error, 'Invitation validation');
  }
};

const handleSendEmailCode = async (request, response) => {
  let verificationRef;
  let code;
  try {
    requireAllowedOrigin(request);
    await checkRateLimit(getClientIp(request), 'send_auth_code_api', 3, 600);
    const email = normalizeEmail(await readSingleFieldBody(request, 'email'));
    const rateLimitRef = db.collection('rate_limits').doc(email);
    const rateLimitSnapshot = await rateLimitRef.get();
    const lastAttempt = rateLimitSnapshot.exists ? rateLimitSnapshot.data().lastAttempt : null;
    if (lastAttempt && Date.now() - lastAttempt.toMillis() < 60_000) {
      throw Object.assign(new Error('Too many attempts. Please wait 1 minute.'), {
        statusCode: 429,
        code: 'rate_limited',
      });
    }

    const { emailUser, transporter } = getEmailTransport();
    code = randomInt(100000, 1000000).toString();
    verificationRef = db.collection('email_verifications').doc(email);
    await rateLimitRef.set({ lastAttempt: FieldValue.serverTimestamp() });
    await verificationRef.set({
      code,
      email,
      expiresAt: Date.now() + 600_000,
      createdAt: FieldValue.serverTimestamp(),
    });

    await transporter.sendMail({
      from: `"Lights Out League" <${emailUser}>`,
      to: email,
      subject: 'Your Verification Code',
      html: verificationEmailHtml(code),
    });
    console.info(JSON.stringify({ message: 'Verification email sent' }));
    sendJson(request, response, 200, { success: true });
  } catch (error) {
    if (verificationRef && code) {
      try {
        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(verificationRef);
          if (snapshot.exists && snapshot.data().code === code) transaction.delete(verificationRef);
        });
      } catch (cleanupError) {
        console.error(JSON.stringify({
          message: 'Verification-code cleanup failed',
          code: cleanupError.code || 'internal',
        }));
      }
    }
    if (!Number.isInteger(error.statusCode)) {
      error.statusCode = 502;
      error.code = 'email_delivery_failed';
      error.message = 'Verification email could not be sent.';
    }
    sendCommandError(request, response, error, 'Verification email');
  }
};

const handleVerifyEmailCode = async (request, response) => {
  try {
    requireAllowedOrigin(request);
    await checkRateLimit(getClientIp(request), 'verify_auth_code_api', 10, 600);
    const body = await readJsonBody(request);
    if (!isPlainObject(body) || Object.keys(body).some((field) => !['email', 'code'].includes(field))) {
      throw Object.assign(new Error('Request must contain only email and code.'), {
        statusCode: 400,
        code: 'invalid_request',
      });
    }
    const email = normalizeEmail(body.email);
    const submittedCode = typeof body.code === 'string' ? body.code.trim() : '';
    if (!/^\d{6}$/.test(submittedCode)) {
      sendJson(request, response, 200, { valid: false, message: 'Invalid code' });
      return;
    }

    const verificationRef = db.collection('email_verifications').doc(email);
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(verificationRef);
      if (!snapshot.exists) return { valid: false, message: 'Code not found' };
      const record = snapshot.data();
      if (Date.now() > record.expiresAt) {
        transaction.delete(verificationRef);
        return { valid: false, message: 'Code expired' };
      }
      if (record.code !== submittedCode) return { valid: false, message: 'Invalid code' };
      transaction.delete(verificationRef);
      return { valid: true };
    });

    sendJson(request, response, 200, result);
  } catch (error) {
    sendCommandError(request, response, error, 'Verification-code check');
  }
};

const handlePasswordReset = async (request, response) => {
  try {
    requireAllowedOrigin(request);
    await checkRateLimit(getClientIp(request), 'password_reset_api', 3, 600);
    const email = normalizeEmail(await readSingleFieldBody(request, 'email'));
    const { emailUser, transporter } = getEmailTransport();

    let resetLink;
    try {
      resetLink = await getAuth().generatePasswordResetLink(email);
    } catch (error) {
      console.info(JSON.stringify({
        message: 'Password reset completed with generic response',
        reason: error.code || 'account_unavailable',
      }));
      sendJson(request, response, 200, { success: true });
      return;
    }

    try {
      await transporter.sendMail({
        from: `"Lights Out League" <${emailUser}>`,
        to: email,
        subject: 'Reset Your Password — Lights Out League',
        html: passwordResetEmailHtml(email, resetLink),
      });
    } catch (error) {
      console.error(JSON.stringify({
        message: 'Password reset email delivery failed',
        code: error.code || 'email_delivery_failed',
      }));
    }

    sendJson(request, response, 200, { success: true });
  } catch (error) {
    sendCommandError(request, response, error, 'Password reset');
  }
};

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const adminEventMatch = pathname.match(/^\/v1\/admin\/events\/([a-z0-9_]{1,40})\/(results|cancellation)$/);

  if (request.method === 'GET' && (pathname === '/' || pathname === '/health')) {
    sendJson(request, response, 200, {
      status: 'ok',
      service: 'lights-out-league-api',
      environment: appEnvironment,
      firebaseProjectId,
    });
    return;
  }

  if (request.method === 'GET' && pathname === '/ready') {
    try {
      const snapshot = await db.collection('app_state').doc('league_config').get();

      if (!snapshot.exists) {
        sendJson(request, response, 503, {
          status: 'not_ready',
          dependency: 'staging-firestore',
          reason: 'required_document_missing',
        });
        return;
      }

      sendJson(request, response, 200, {
        status: 'ready',
        dependency: 'staging-firestore',
        environment: appEnvironment,
        firebaseProjectId,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'Firestore readiness check failed',
          code: error.code || 'unknown',
        }),
      );
      sendJson(request, response, 503, {
        status: 'not_ready',
        dependency: 'staging-firestore',
        reason: 'dependency_unavailable',
      });
    }
    return;
  }

  if (
    request.method === 'OPTIONS'
    && (
      pathname === '/v1/admin/leaderboard/recalculate'
      || adminEventMatch
      || publicAuthPaths.has(pathname)
    )
  ) {
    const origin = request.headers.origin;
    if (!origin || !allowedOrigins.has(origin)) {
      sendJson(request, response, 403, {
        success: false,
        error: { code: 'origin_not_allowed', message: 'Request origin is not allowed.' },
      });
      return;
    }
    response.writeHead(204, corsHeaders(request));
    response.end();
    return;
  }

  if (request.method === 'POST' && pathname === '/v1/admin/leaderboard/recalculate') {
    await handleManualLeaderboardSync(request, response);
    return;
  }

  if (request.method === 'POST' && pathname === '/v1/auth/invitations/validate') {
    await handleValidateInvitation(request, response);
    return;
  }

  if (request.method === 'POST' && pathname === '/v1/auth/email-code/send') {
    await handleSendEmailCode(request, response);
    return;
  }

  if (request.method === 'POST' && pathname === '/v1/auth/email-code/verify') {
    await handleVerifyEmailCode(request, response);
    return;
  }

  if (request.method === 'POST' && pathname === '/v1/auth/password-reset') {
    await handlePasswordReset(request, response);
    return;
  }

  if (adminEventMatch?.[2] === 'results' && request.method === 'PUT') {
    await handleSaveRaceResults(request, response, adminEventMatch[1]);
    return;
  }

  if (adminEventMatch?.[2] === 'cancellation' && request.method === 'PUT') {
    await handleCancelEvent(request, response, adminEventMatch[1]);
    return;
  }

  if (adminEventMatch?.[2] === 'cancellation' && request.method === 'DELETE') {
    await handleRestoreEvent(request, response, adminEventMatch[1]);
    return;
  }

  sendJson(request, response, 404, {
    status: 'not_found',
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(
    JSON.stringify({
      message: 'API listening',
      port,
      environment: appEnvironment,
      firebaseProjectId,
    }),
  );
});
