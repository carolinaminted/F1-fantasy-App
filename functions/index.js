
/**
 * Firebase Cloud Functions for F1 Fantasy League (Gen 2)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const functions = require("firebase-functions");
const logger = functions.logger;
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// --- CONSTANTS ---
const DEFAULT_POINTS = {
  grandPrixFinish: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  sprintFinish: [8, 7, 6, 5, 4, 3, 2, 1],
  fastestLap: 3,
  gpQualifying: [3, 2, 1],
  sprintQualifying: [3, 2, 1],
};

// --- SHARED SCORING ENGINE ---

const getDriverPoints = (driverId, resultList, pointsList) => {
    if (!driverId || !resultList || !pointsList) return 0;
    const idx = resultList.indexOf(driverId);
    return idx !== -1 ? (pointsList[idx] || 0) : 0;
};

const calculateEventScore = (picks, results, system, drivers) => {
    if (!picks || !results) return { total: 0, breakdown: { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 } };

    const getTeamId = (driverId) => {
        if(results.driverTeams && results.driverTeams[driverId]) return results.driverTeams[driverId];
        const d = drivers.find(drv => drv.id === driverId);
        return d ? d.constructorId : null;
    };

    let gpPoints = 0, sprintPoints = 0, qualiPoints = 0, flPoints = 0, p22Count = 0;

    const teamIds = [...(picks.aTeams || []), picks.bTeam].filter(Boolean);
    results.grandPrixFinish?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) gpPoints += (system.grandPrixFinish[idx] || 0);
    });
    results.sprintFinish?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) sprintPoints += (system.sprintFinish[idx] || 0);
    });
    results.gpQualifying?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) qualiPoints += (system.gpQualifying[idx] || 0);
    });
    results.sprintQualifying?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) qualiPoints += (system.sprintQualifying[idx] || 0);
    });

    const driverIds = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean);
    driverIds.forEach(dId => {
        gpPoints += getDriverPoints(dId, results.grandPrixFinish, system.grandPrixFinish);
        sprintPoints += getDriverPoints(dId, results.sprintFinish, system.sprintFinish);
        qualiPoints += getDriverPoints(dId, results.gpQualifying, system.gpQualifying);
        qualiPoints += getDriverPoints(dId, results.sprintQualifying, system.sprintQualifying);
    });

    if (picks.fastestLap && picks.fastestLap === results.fastestLap) {
        flPoints += system.fastestLap;
    }

    // P22 Tracker Logic
    if (results.p22Driver && driverIds.includes(results.p22Driver)) {
        p22Count = 1;
    }

    let total = gpPoints + sprintPoints + qualiPoints + flPoints;

    if (picks.penalty && picks.penalty > 0) {
        const deduction = Math.ceil(total * picks.penalty);
        total -= deduction;
    }

    return { total, breakdown: { gp: gpPoints, sprint: sprintPoints, quali: qualiPoints, fl: flPoints, p22: p22Count } };
};

/**
 * Clean Sweep Recalculation
 * Processes every user against every completed result to ensure 100% integrity.
 */
const recalculateEntireLeague = async () => {
    logger.info("Starting recalculateEntireLeague...");
    
    // Fetch picks, results, config, AND user profiles to sync display names
    const [resultsSnap, picksSnap, scoringSnap, entitiesSnap, usersSnap] = await Promise.all([
        db.collection('app_state').doc('race_results').get(),
        db.collection('userPicks').get(),
        db.collection('app_state').doc('scoring_config').get(),
        db.collection('app_state').doc('entities').get(),
        db.collection('users').get() // Fetch profiles to repair missing public_users names
    ]);

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
    
    let pointsSystem = DEFAULT_POINTS;
    if (scoringSnap.exists) {
        const data = scoringSnap.data();
        if (data.profiles && data.activeProfileId) {
            const active = data.profiles.find(p => p.id === data.activeProfileId);
            if (active) pointsSystem = active.config;
        } else if (!data.profiles) {
            pointsSystem = data; 
        }
    }

    const leaderboardScores = [];

    picksSnap.forEach(pickDoc => {
        const userId = pickDoc.id;
        const allUserPicks = pickDoc.data();
        
        let totalPoints = 0;
        let breakdown = { gp: 0, sprint: 0, quali: 0, fl: 0, p22: 0 };

        Object.keys(allUserPicks).forEach(eventId => {
            const result = raceResults[eventId];
            if (result) {
                const systemToUse = result.scoringSnapshot || pointsSystem;
                const score = calculateEventScore(allUserPicks[eventId], result, systemToUse, driversList);
                totalPoints += score.total;
                breakdown.gp += score.breakdown.gp;
                breakdown.sprint += score.breakdown.sprint;
                breakdown.quali += score.breakdown.quali;
                breakdown.fl += score.breakdown.fl;
                if (score.breakdown.p22) {
                    breakdown.p22 = (breakdown.p22 || 0) + score.breakdown.p22;
                }
            }
        });

        // Use the name from the users collection, fallback to ID if completely missing
        const displayName = userProfileMap[userId] || `Team ${userId.substring(0, 4)}`;

        leaderboardScores.push({ userId, displayName, totalPoints, breakdown });
    });

    leaderboardScores.sort((a, b) => b.totalPoints - a.totalPoints);

    const batch = db.batch();
    leaderboardScores.forEach((score, index) => {
        const publicRef = db.collection('public_users').doc(score.userId);
        batch.set(publicRef, {
            displayName: score.displayName, // Repair name
            totalPoints: score.totalPoints,
            breakdown: score.breakdown,
            rank: index + 1,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    });

    await batch.commit();
    logger.info(`recalculateEntireLeague complete. Processed ${leaderboardScores.length} users.`);
    return leaderboardScores.length;
};

// --- AUTH & RATE LIMIT UTILS ---

const getClientIp = (request) => {
    if (!request.rawRequest) return "unknown";
    const xForwarded = request.rawRequest.headers['x-forwarded-for'];
    if (xForwarded) return xForwarded.split(',')[0].trim();
    return request.rawRequest.ip || request.rawRequest.socket?.remoteAddress || "unknown";
};

const checkRateLimit = async (ip, operation, limit, windowSeconds) => {
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
                logger.warn(`IP ${ip} rate limited for operation ${operation}.`);
                throw new HttpsError('resource-exhausted', `Too many attempts. Please try again in ${Math.ceil((data.resetTime.seconds - now.seconds) / 60)} minutes.`);
            }
            t.update(docRef, { count: data.count + 1 });
        }
    });
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

exports.manualLeaderboardSync = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Login required.');
    }

    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!userDoc.exists || !userDoc.data().isAdmin) {
        logger.error(`Unauthorized manual sync attempt from ${request.auth.uid}`);
        throw new HttpsError('permission-denied', 'Only admins can trigger a league sync.');
    }

    const clientIp = getClientIp(request);
    await checkRateLimit(clientIp, 'manual_sync', 5, 300);

    try {
        const count = await recalculateEntireLeague();
        return { success: true, usersProcessed: count };
    } catch (err) {
        logger.error("manualLeaderboardSync internal failure:", err);
        throw new HttpsError('internal', 'Recalculation failed on server.');
    }
});

exports.sendAuthCode = onCall({ cors: true, memory: "512MiB" }, async (request) => {
  const email = request.data.email;
  if (!email) throw new HttpsError("invalid-argument", "Email is required");

  const clientIp = getClientIp(request);
  await checkRateLimit(clientIp, 'send_auth_code', 3, 600);

  const rateLimitRef = db.collection("rate_limits").doc(email.toLowerCase());
  const rateLimitDoc = await rateLimitRef.get();
  if (rateLimitDoc.exists) {
      const lastAttempt = rateLimitDoc.data().lastAttempt;
      if (lastAttempt && Date.now() - lastAttempt.toMillis() < 60000) {
          throw new HttpsError("resource-exhausted", "Too many attempts. Please wait 1 minute.");
      }
  }
  await rateLimitRef.set({ lastAttempt: admin.firestore.FieldValue.serverTimestamp() });

  let gmailEmail = process.env.EMAIL_USER || "your-email@gmail.com";
  let gmailPassword = process.env.EMAIL_PASS || "your-app-password";
  
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  await db.collection("email_verifications").doc(email.toLowerCase()).set({
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
    const { email, code } = request.data;
    if (!email || !code) return { valid: false, message: "Missing data" };

    const docRef = db.collection("email_verifications").doc(email.toLowerCase());
    const doc = await docRef.get();

    if (!doc.exists) return { valid: false, message: "Code not found" };
    const record = doc.data();
    if (Date.now() > record.expiresAt) return { valid: false, message: "Code expired" };
    if (record.code !== code) return { valid: false, message: "Invalid code" };

    await docRef.delete();
    return { valid: true };
});

exports.validateInvitationCode = onCall({ cors: true }, async (request) => {
    const { code } = request.data;
    if (!code) throw new HttpsError("invalid-argument", "Code required");
    const clientIp = getClientIp(request);
    await checkRateLimit(clientIp, 'validate_invitation', 5, 600);

    const codeRef = db.collection("invitation_codes").doc(code);
    return await db.runTransaction(async (t) => {
        const doc = await t.get(codeRef);
        if (!doc.exists) throw new HttpsError("not-found", "Invalid code");
        if (doc.data().status !== 'active') throw new HttpsError("failed-precondition", "Code used");
        t.update(codeRef, { status: 'reserved', reservedAt: admin.firestore.FieldValue.serverTimestamp() });
        return { valid: true };
    });
});

exports.sendPasswordResetLink = onCall({ cors: true, memory: "512MiB" }, async (request) => {
    const email = request.data.email;
    if (!email) throw new HttpsError("invalid-argument", "Email is required");

    const clientIp = getClientIp(request);
    await checkRateLimit(clientIp, 'password_reset', 3, 600);

    let gmailEmail = process.env.EMAIL_USER || "your-email@gmail.com";
    let gmailPassword = process.env.EMAIL_PASS || "your-app-password";

    if (gmailEmail === "your-email@gmail.com" || gmailPassword === "your-app-password") {
        throw new HttpsError("failed-precondition", "Email service not configured.");
    }

    try {
        // Generate the password reset link via Firebase Admin SDK
        const resetLink = await admin.auth().generatePasswordResetLink(email);

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

        const transporter = nodemailer.createTransport({ 
            service: "gmail", 
            auth: { user: gmailEmail, pass: gmailPassword } 
        });

        await transporter.sendMail({
            from: `"Lights Out League" <${gmailEmail}>`,
            to: email,
            subject: "Reset Your Password — Lights Out League",
            html: htmlContent
        });

    } catch (err) {
        // CRITICAL: Do NOT expose whether the email exists in the system.
        // auth/user-not-found should be caught silently.
        // Log for debugging but return generic success.
        logger.warn("Password reset attempt error (masked):", err.code || err.message);
    }

    // Always return success to prevent email enumeration
    return { success: true };
});
