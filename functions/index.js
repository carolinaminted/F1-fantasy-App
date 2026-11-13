
/**
 * Firebase Cloud Functions for F1 Fantasy League (Gen 2)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
const functions = require("firebase-functions");
const logger = functions.logger;
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const { resolveRuntimeTarget } = require("./runtime-target");
const { resolveRuntimeServiceAccount, resolveDeployProjectId } = require("./runtime-service-account");
const { resolveEmailSecretNames } = require("./email-secrets");
const { parseScoredEventIds } = require("./season-config");
const { concludeSeason } = require("./season-ops/conclude");
const { archiveSeason } = require("./season-ops/archive");
const { resetSeason } = require("./season-ops/reset");
const { backupLeague } = require("./season-ops/backup");
const { resolveBackupBucket } = require("./backup-buckets");
const { LONG_RUNNING } = require("./deploy-targets");
const { openSeason } = require("./season-ops/open");
const { evaluateCodeAttempt } = require("./auth-code");
const { resolveClientIp } = require("./client-ip");
const { normalizeEmail } = require("./email-address");
const { resolvePointsSystem, scoreUserSeason } = require("./scoring");

// Run as a dedicated least-privilege account instead of the default compute service account,
// which holds roles/editor. See runtime-service-account.js for which identity lands where.
const runtimeServiceAccount = resolveRuntimeServiceAccount();
if (runtimeServiceAccount) {
  setGlobalOptions({ serviceAccount: runtimeServiceAccount });
}

// The Gmail app password, declared here rather than bound after the deploy. See email-secrets.js
// for why that distinction matters and which projects are listed.
//
// An unlisted project (formula-fantasy-1) resolves to null: no secrets are declared, and the
// handlers fall back to reading EMAIL_USER / EMAIL_PASS from the environment, which is what that
// project does today.
const emailSecretNames = resolveEmailSecretNames();
const emailSecrets = emailSecretNames
  ? { user: defineSecret(emailSecretNames.user), pass: defineSecret(emailSecretNames.pass) }
  : null;

// Passed as the `secrets:` option on the two email handlers, so firebase-tools binds them.
const emailSecretParams = emailSecrets ? [emailSecrets.user, emailSecrets.pass] : [];

/**
 * The Gmail credentials, read at call time. `.value()` must not be hoisted to module scope —
 * during discovery the secret has no value yet, and reading it there would bake in an empty one.
 */
const emailCredentials = () => ({
  user: emailSecrets ? emailSecrets.user.value() : process.env.EMAIL_USER,
  pass: emailSecrets ? emailSecrets.pass.value() : process.env.EMAIL_PASS,
});

const runtimeTarget = resolveRuntimeTarget();
if (runtimeTarget) {
  admin.initializeApp({ projectId: runtimeTarget.firebaseProjectId });
} else {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Clean Sweep Recalculation
 * Processes every user against every completed result to ensure 100% integrity.
 */
const recalculateEntireLeague = async () => {
    logger.info("Starting recalculateEntireLeague...");
    
    // Fetch picks, results, config, user profiles, AND cancelled events
    const [resultsSnap, picksSnap, scoringSnap, entitiesSnap, usersSnap, cancelledSnap, seasonSnap] = await Promise.all([
        db.collection('app_state').doc('race_results').get(),
        db.collection('userPicks').get(),
        db.collection('app_state').doc('scoring_config').get(),
        db.collection('app_state').doc('entities').get(),
        db.collection('users').get(),
        db.collection('app_state').doc('cancelled_events').get(),
        db.collection('season_config').doc('current').get()
    ]);

    const scoredEventIds = parseScoredEventIds(seasonSnap);

    if (!resultsSnap.exists) {
        logger.warn("Recalculation aborted: No race results found.");
        return 0;
    }

    const raceResults = resultsSnap.data();
    const driversList = entitiesSnap.exists ? (entitiesSnap.data().drivers || []) : [];
    
    // Create Map of UserID -> DisplayName
    const userProfileMap = {};
    usersSnap.forEach(doc => {
        userProfileMap[doc.id] = doc.data().displayName || 'Unknown Team';
    });
    
    const pointsSystem = resolvePointsSystem(scoringSnap.exists ? scoringSnap.data() : undefined);

    // Build set of cancelled event IDs
    const cancelledEventIds = new Set(
        cancelledSnap.exists && cancelledSnap.data().events
            ? Object.keys(cancelledSnap.data().events)
            : []
    );
    if (cancelledEventIds.size > 0) {
        logger.info(`Excluding ${cancelledEventIds.size} cancelled event(s): ${[...cancelledEventIds].join(', ')}`);
    }

    const leaderboardScores = [];

    picksSnap.forEach(pickDoc => {
        const userId = pickDoc.id;
        const { totalPoints, breakdown } = scoreUserSeason(
            pickDoc.data(), raceResults, pointsSystem, driversList, scoredEventIds, cancelledEventIds);

        // Use the name from the users collection, fallback to ID if completely missing
        const displayName = userProfileMap[userId] || `Team ${userId.substring(0, 4)}`;

        leaderboardScores.push({ userId, displayName, totalPoints, breakdown });
    });

    leaderboardScores.sort((a, b) => b.totalPoints - a.totalPoints);

    // public_users.rank is the only rank the app shows; the client never re-ranks.
    // Standard competition ranking: tied points share a rank (1, 2, 2, 4).
    leaderboardScores.forEach((score, index) => {
        const prev = leaderboardScores[index - 1];
        score.rank = prev && prev.totalPoints === score.totalPoints ? prev.rank : index + 1;
    });

    const batch = db.batch();
    leaderboardScores.forEach((score) => {
        const publicRef = db.collection('public_users').doc(score.userId);
        batch.set(publicRef, {
            displayName: score.displayName, // Repair name
            totalPoints: score.totalPoints,
            breakdown: score.breakdown,
            rank: score.rank,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });

    await batch.commit();
    logger.info(`recalculateEntireLeague complete. Processed ${leaderboardScores.length} users.`);
    return leaderboardScores.length;
};

// --- AUTH & RATE LIMIT UTILS ---

const getClientIp = (request) => {
    const raw = request.rawRequest;
    return resolveClientIp(raw?.headers, raw?.ip || raw?.socket?.remoteAddress);
};

const checkRateLimit = async (request, operation, limit, windowSeconds) => {
    const ip = getClientIp(request);
    const safeIp = ip.replace(/[^a-zA-Z0-9]/g, '_');
    const docRef = db.collection('rate_limits_ip').doc(`${operation}_${safeIp}`);

    await db.runTransaction(async (t) => {
        const doc = await t.get(docRef);
        const now = admin.firestore.Timestamp.now();
        let data = doc.exists ? doc.data() : null;

        if (!data || now.seconds > data.resetTime.seconds) {
            t.set(docRef, {
                count: 1,
                resetTime: new admin.firestore.Timestamp(now.seconds + windowSeconds, 0)
            });
        } else {
            if (data.count >= limit) {
                // The raw header is logged so the trusted hop count in client-ip.js can be checked against real traffic.
                logger.warn("rate_limited", { event: "rate_limited", operation, ip, xForwardedFor: request.rawRequest?.headers?.["x-forwarded-for"] ?? null });
                throw new HttpsError('resource-exhausted', `Too many attempts. Please try again in ${Math.ceil((data.resetTime.seconds - now.seconds) / 60)} minutes.`);
            }
            t.update(docRef, { count: data.count + 1 });
        }
    });
};

const requireAdmin = async (request, action) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login required.');
    }
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || !userDoc.data().isAdmin) {
        logger.error(`Unauthorized ${action} attempt from ${request.auth.uid}`);
        throw new HttpsError('permission-denied', 'Only admins can do this.');
    }
};

// --- EXPORTED FUNCTIONS ---

exports.updateLeaderboardOnResults = onDocumentWritten(
    { document: 'app_state/race_results', memory: "512MiB", timeoutSeconds: 300 }, 
    async (event) => {
        if (!event.data || !event.data.after.exists) return;
        logger.info("Auto-sync triggered by results update.");
        await recalculateEntireLeague();
    }
);

exports.updateLeaderboardOnCancellation = onDocumentWritten(
    { document: 'app_state/cancelled_events', memory: "512MiB", timeoutSeconds: 300 },
    async (event) => {
        logger.info("Auto-sync triggered by event cancellation/restoration.");
        await recalculateEntireLeague();
    }
);

exports.manualLeaderboardSync = onCall({ cors: true }, async (request) => {
    await requireAdmin(request, 'manual sync');

    await checkRateLimit(request, 'manual_sync', 5, 300);

    try {
        const count = await recalculateEntireLeague();
        return { success: true, usersProcessed: count };
    } catch (err) {
        logger.error("manualLeaderboardSync internal failure:", err);
        throw new HttpsError('internal', 'Recalculation failed on server.');
    }
});

/**
 * One admin-only callable per season lifecycle step. The step modules enforce every precondition
 * and throw a message written for the admin, which is passed back as failed-precondition.
 */
const seasonOpCallable = (action, run, options = {}) => onCall({ cors: true, ...options }, async (request) => {
    await requireAdmin(request, action);
    await checkRateLimit(getClientIp(request), 'season_ops', 5, 300);
    const seasonId = request.data && request.data.seasonId;
    if (typeof seasonId !== 'string' || !seasonId) {
        throw new HttpsError('invalid-argument', 'seasonId is required.');
    }
    const log = (ok) => db.collection('admin_logs').add({
        action, seasonId, uid: request.auth.uid, ok, at: admin.firestore.FieldValue.serverTimestamp(),
    });
    try {
        const result = await run(db, { seasonId, FieldValue: admin.firestore.FieldValue });
        await log(result.ok !== false);
        return result;
    } catch (err) {
        await log(false);
        logger.error(`${action} failed:`, err);
        throw new HttpsError('failed-precondition', err.message);
    }
});

exports.concludeSeason = seasonOpCallable('season_conclude', concludeSeason);
exports.archiveSeason = seasonOpCallable('season_archive', archiveSeason, LONG_RUNNING.archiveSeason);
// The export runs against the data plane, which on the portal is not the hosting project.
const dataProjectId = runtimeTarget ? runtimeTarget.firebaseProjectId : resolveDeployProjectId();
const exportDocuments = async (request) => {
    const client = new admin.firestore.v1.FirestoreAdminClient();
    const [operation] = await client.exportDocuments(request);
    await operation.promise();
    return { name: operation.name };
};
exports.backupLeague = seasonOpCallable('season_backup', (database, { seasonId, FieldValue }) => backupLeague(database, {
    seasonId, FieldValue, exportDocuments, projectId: dataProjectId, bucket: resolveBackupBucket(dataProjectId),
}), LONG_RUNNING.backupLeague);
exports.startNewSeason = seasonOpCallable('season_start', resetSeason, LONG_RUNNING.startNewSeason);
exports.openSeason = seasonOpCallable('season_open', openSeason);

exports.sendAuthCode = onCall({ cors: true, memory: "512MiB", secrets: emailSecretParams }, async (request) => {
  const email = normalizeEmail(request.data.email);
  if (!email) throw new HttpsError("invalid-argument", "A valid email address is required");

  await checkRateLimit(request, 'send_auth_code', 3, 600);

  const rateLimitRef = db.collection("rate_limits").doc(email);
  const rateLimitDoc = await rateLimitRef.get();
  if (rateLimitDoc.exists) {
      const lastAttempt = rateLimitDoc.data().lastAttempt;
      if (lastAttempt && Date.now() - lastAttempt.toMillis() < 60000) {
          throw new HttpsError("resource-exhausted", "Too many attempts. Please wait 1 minute.");
      }
  }
  await rateLimitRef.set({ lastAttempt: admin.firestore.FieldValue.serverTimestamp() });

  const credentials = emailCredentials();
  let gmailEmail = credentials.user || "your-email@gmail.com";
  let gmailPassword = credentials.pass || "your-app-password";
  
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await db.collection("email_verifications").doc(email).set({
    code: code, email: email, expiresAt: Date.now() + 600000,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Security Fix: Demo Mode Code Exposure in Production
  // Only in dev/test environments - remove from production bundle 
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEMO_MODE === 'true') {
      return { success: true, demoMode: true, code: code };
  }

  if (gmailEmail === "your-email@gmail.com" || gmailPassword === "your-app-password") {
      throw new HttpsError("failed-precondition", "Email service not configured.");
  }

  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: gmailEmail, pass: gmailPassword } });
  
  // Updated Email Template with "Lights Out League" branding and carbon fiber styling
  const htmlContent = `
    <div style="background-color: #0A0A0A; color: #F5F5F5; font-family: 'Arial', sans-serif; padding: 40px; text-align: center; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #2C2C2C;">
      <div style="margin-bottom: 40px;">
        <!-- Logo Approximation -->
        <div style="font-size: 36px; font-weight: 900; font-style: italic; line-height: 1; letter-spacing: -1px; margin-bottom: 5px;">
          <span style="color: #DA291C;">LIGHTS</span> <span style="color: #FFFFFF;">OUT</span>
        </div>
        <div style="font-size: 14px; font-weight: 400; letter-spacing: 0.4em; color: #FFFFFF;">
          LEAGUE
        </div>
      </div>
      
      <div style="margin-bottom: 25px; font-size: 16px; color: #C0C0C0;">
        Your verification code is:
      </div>
      
      <div style="background-color: #1a1a1a; color: #FFFFFF; font-size: 42px; font-weight: bold; letter-spacing: 8px; padding: 25px; border-radius: 8px; border: 1px solid #DA291C; display: inline-block; margin-bottom: 30px; box-shadow: 0 0 15px rgba(218, 41, 28, 0.2);">
        ${code}
      </div>
      
      <div style="font-size: 12px; color: #666666; margin-top: 20px; border-top: 1px solid #333333; padding-top: 20px;">
        This code expires in 10 minutes.<br/>
        If you didn't request this, please ignore this email.
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Lights Out League" <${gmailEmail}>`,
    to: email,
    subject: "Your Verification Code",
    html: htmlContent
  });
  return { success: true };
});

exports.verifyAuthCode = onCall({ cors: true }, async (request) => {
    const email = normalizeEmail(request.data.email);
    const { code } = request.data;
    if (!email || !code) return { valid: false, message: "Missing data" };

    await checkRateLimit(request, 'verify_auth_code', 10, 600);

    const docRef = db.collection("email_verifications").doc(email);
    // Transactional so parallel guesses cannot all read the same failure count and slip past the cap.
    const result = await db.runTransaction(async (t) => {
        const doc = await t.get(docRef);
        const outcome = evaluateCodeAttempt(doc.exists ? doc.data() : null, code, Date.now());
        if (outcome.action === 'delete') t.delete(docRef);
        if (outcome.action === 'increment') t.update(docRef, { failedAttempts: outcome.failedAttempts });
        return outcome;
    });

    if (!result.valid) return { valid: false, message: result.message };
    return { valid: true };
});

exports.validateInvitationCode = onCall({ cors: true }, async (request) => {
    const { code } = request.data;
    if (!code) throw new HttpsError("invalid-argument", "Code required");
    await checkRateLimit(request, 'validate_invitation', 5, 600);

    const codeRef = db.collection("invitation_codes").doc(code);
    return await db.runTransaction(async (t) => {
        const doc = await t.get(codeRef);
        if (!doc.exists) throw new HttpsError("not-found", "Invalid code");
        if (doc.data().status !== 'active') throw new HttpsError("failed-precondition", "Code used");
        t.update(codeRef, { status: 'reserved', reservedAt: admin.firestore.FieldValue.serverTimestamp() });
        return { valid: true };
    });
});

exports.sendPasswordResetLink = onCall({ cors: true, memory: "512MiB", secrets: emailSecretParams }, async (request) => {
    const email = normalizeEmail(request.data.email);
    if (!email) throw new HttpsError("invalid-argument", "A valid email address is required");

    await checkRateLimit(request, 'password_reset', 3, 600);

    const { user: gmailEmail, pass: gmailPassword } = emailCredentials();

    logger.info(`Password reset requested for ${email.substring(0, 3)}***. Config status: EMAIL_USER=${!!gmailEmail}, EMAIL_PASS=${!!gmailPassword}`);

    if (!gmailEmail || gmailEmail === "your-email@gmail.com" || !gmailPassword || gmailPassword === "your-app-password") {
        throw new HttpsError("failed-precondition", "Email service not configured.");
    }

    let resetLink;
    try {
        logger.info("Attempting Firebase Admin generatePasswordResetLink...");
        resetLink = await admin.auth().generatePasswordResetLink(email);
        logger.info("Reset link generated successfully");
    } catch (err) {
        logger.error("STEP 1 FAILED - Firebase Admin SDK:", {
            code: err.code,
            message: err.message,
            errorInfo: err.errorInfo,
            fullError: JSON.stringify(err),
        });
        // Always return success to prevent email enumeration
        return { success: true };
    }

    const htmlContent = `
      <div style="background-color: #0A0A0A; color: #F5F5F5; font-family: 'Arial', sans-serif; padding: 40px; text-align: center; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #2C2C2C;">
        <div style="margin-bottom: 40px;">
          <div style="font-size: 36px; font-weight: 900; font-style: italic; line-height: 1; letter-spacing: -1px; margin-bottom: 5px;">
            <span style="color: #DA291C;">LIGHTS</span> <span style="color: #FFFFFF;">OUT</span>
          </div>
          <div style="font-size: 14px; font-weight: 400; letter-spacing: 0.4em; color: #FFFFFF;">
            LEAGUE
          </div>
        </div>
        <div style="margin-bottom: 10px; font-size: 18px; font-weight: bold; color: #FFFFFF;">
          Password Reset Request
        </div>
        <div style="margin-bottom: 25px; font-size: 14px; color: #C0C0C0;">
          We received a request to reset the password for<br/>
          <span style="color: #FFFFFF; font-weight: bold;">${email}</span>
        </div>
        <div style="margin-bottom: 30px;">
          <a href="${resetLink}" 
             style="background-color: #DA291C; color: #FFFFFF; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 40px; border-radius: 8px; display: inline-block; letter-spacing: 1px; box-shadow: 0 0 15px rgba(218, 41, 28, 0.3);">
            RESET PASSWORD
          </a>
        </div>
        <div style="font-size: 12px; color: #666666; margin-bottom: 15px;">
          This link expires in 1 hour.
        </div>
        <div style="font-size: 12px; color: #666666; border-top: 1px solid #333333; padding-top: 20px;">
          If you didn't request a password reset, you can safely ignore this email.<br/>
          Your password will remain unchanged.
        </div>
      </div>
    `;

    try {
        const transporter = nodemailer.createTransport({ 
            service: "gmail", 
            auth: { user: gmailEmail, pass: gmailPassword } 
        });

        logger.info("Attempting nodemailer sendMail...");
        await transporter.sendMail({
            from: `"Lights Out League" <${gmailEmail}>`,
            to: email,
            subject: "Reset Your Password — Lights Out League",
            html: htmlContent
        });
        logger.info("Email sent successfully");
    } catch (err) {
        logger.error("STEP 2 FAILED - Nodemailer SMTP:", {
            code: err.code,
            message: err.message,
            responseCode: err.responseCode,
            command: err.command,
        });
    }

    // Always return success to prevent email enumeration
    return { success: true };
});
