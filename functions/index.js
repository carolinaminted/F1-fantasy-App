
/**
 * Firebase Cloud Functions for F1 Fantasy League (Gen 2)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const functions = require("firebase-functions"); // Keep v1 for legacy access if needed elsewhere
const logger = functions.logger; // Use standard Firebase logger
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// --- UTILS ---

const maskEmail = (email) => {
  if (!email || typeof email !== 'string') return "unknown";
  const parts = email.split("@");
  if (parts.length < 2) return "invalid";
  // Mask: f***@gmail.com
  return `${parts[0].charAt(0)}***@${parts[1]}`;
};

const getClientIp = (request) => {
    // Gen 2 functions expose rawRequest (Express req object)
    if (!request.rawRequest) return "unknown";
    
    // Check x-forwarded-for header (standard for proxies/load balancers)
    const xForwarded = request.rawRequest.headers['x-forwarded-for'];
    if (xForwarded) {
        // Format: client, proxy1, proxy2
        return xForwarded.split(',')[0].trim();
    }
    
    return request.rawRequest.ip || request.rawRequest.socket?.remoteAddress || "unknown";
};

/**
 * Enforces rate limiting by IP address using Firestore.
 * @param {string} ip - The client's IP address.
 * @param {string} operation - Unique identifier for the operation (e.g., 'auth_code').
 * @param {number} limit - Max attempts allowed in the window.
 * @param {number} windowSeconds - Time window in seconds.
 */
const checkRateLimit = async (ip, operation, limit, windowSeconds) => {
    // Sanitize IP for document ID (replace colons/dots with underscores)
    const safeIp = ip.replace(/[^a-zA-Z0-9]/g, '_');
    const docRef = db.collection('rate_limits_ip').doc(`${operation}_${safeIp}`);

    await db.runTransaction(async (t) => {
        const doc = await t.get(docRef);
        const now = admin.firestore.Timestamp.now();
        let data = doc.exists ? doc.data() : null;

        // If no record or window expired, reset
        if (!data || now.seconds > data.resetTime.seconds) {
            t.set(docRef, {
                count: 1,
                resetTime: new admin.firestore.Timestamp(now.seconds + windowSeconds, 0)
            });
        } else {
            // Check limit
            if (data.count >= limit) {
                throw new HttpsError('resource-exhausted', `Too many attempts. Please try again in ${Math.ceil((data.resetTime.seconds - now.seconds) / 60)} minutes.`);
            }
            // Increment
            t.update(docRef, { count: data.count + 1 });
        }
    });
};

// --- DIAGNOSTICS ---

exports.ping = onCall((request) => {
    return { message: "pong (v2)", timestamp: Date.now() };
});

// --- EMAIL VERIFICATION ---

exports.sendAuthCode = onCall({ cors: true }, async (request) => {
  // PII Guard: Do not log full request data
  logger.info("EXECUTION START: sendAuthCode");

  const email = request.data.email;
  if (!email) {
    logger.error("Missing email in request");
    throw new HttpsError("invalid-argument", "Email is required");
  }

  const clientIp = getClientIp(request);

  // 1. IP Rate Limiting (Prevent Spamming Multiple Emails)
  // Limit: 3 requests per 10 minutes per IP
  await checkRateLimit(clientIp, 'send_auth_code', 3, 600);

  // 2. Email Rate Limiting (Prevent Spamming Single Email)
  const rateLimitRef = db.collection("rate_limits").doc(email.toLowerCase());
  const rateLimitDoc = await rateLimitRef.get();
  if (rateLimitDoc.exists) {
      const lastAttempt = rateLimitDoc.data().lastAttempt;
      // Check if lastAttempt exists and is within 60 seconds
      if (lastAttempt && Date.now() - lastAttempt.toMillis() < 60000) {
          logger.warn(`Rate limit exceeded for user ${maskEmail(email)}`);
          throw new HttpsError("resource-exhausted", "Too many attempts. Please wait 1 minute before trying again.");
      }
  }
  // Update rate limit timestamp
  await rateLimitRef.set({ lastAttempt: admin.firestore.FieldValue.serverTimestamp() });

  // 3. Config Loading (V2 Compatible)
  let gmailEmail = process.env.EMAIL_USER || process.env.GMAIL_USER || "your-email@gmail.com";
  let gmailPassword = process.env.EMAIL_PASS || process.env.GMAIL_PASS || "your-app-password";
  
  // Production Security Guard [S1C-05]
  const PROJECT_ID = process.env.GCLOUD_PROJECT || "unknown";
  const IS_PRODUCTION = PROJECT_ID === "formula-fantasy-1";

  // Production Flag: Set ENABLE_DEMO_MODE="true" in Cloud Run env vars to enable the fallback
  let enableDemoMode = process.env.ENABLE_DEMO_MODE === 'true';
  
  if (IS_PRODUCTION && enableDemoMode) {
      logger.warn("SECURITY ALERT: ENABLE_DEMO_MODE attempted in PRODUCTION. Automatically disabled by runtime guard.");
      enableDemoMode = false;
  }
  
  const isDefaultUser = gmailEmail === "your-email@gmail.com";
  const isDefaultPass = gmailPassword === "your-app-password";
  
  logger.info("SMTP Configuration Check", {
      configuredUser: isDefaultUser ? "DEFAULT (Not Set)" : "Configured",
      isConfigValid: !isDefaultUser && !isDefaultPass,
      demoModeAllowed: enableDemoMode,
      environment: IS_PRODUCTION ? "PRODUCTION" : "DEV/TEST"
  });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 600000; // 10 minutes

  // 4. Write to Firestore
  try {
    const docId = email.toLowerCase(); 
    await db.collection("email_verifications").doc(docId).set({
      code: code,
      email: email, 
      expiresAt: expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    if (enableDemoMode) {
        logger.info(`>>> DEMO MODE: GENERATED CODE FOR ${maskEmail(email)}: ${code} <<<`);
    }

  } catch (dbError) {
      logger.error("❌ FIRESTORE WRITE FAILED", dbError);
      throw new HttpsError("internal", "Database error: Unable to save verification code.");
  }

  // 5. Demo Mode / Missing Config Check
  if (isDefaultUser || isDefaultPass) {
      if (enableDemoMode) {
          logger.warn(">>> DEMO MODE ACTIVE: Email verification skipped due to missing config. Returning code to client. <<<");
          return { success: true, demoMode: true, code: code };
      } else {
          logger.error("SMTP Config missing and Demo Mode is disabled.");
          throw new HttpsError("failed-precondition", "Email service is not configured. Please contact support.");
      }
  }

  // 6. Send Email
  try {
    logger.info("Initializing Nodemailer...");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailEmail, pass: gmailPassword },
    });

    const mailOptions = {
      from: `"F1 Fantasy League" <${gmailEmail}>`,
      to: email,
      subject: "Your Verification Code",
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #DA291C;">F1 Fantasy One</h2>
          <p>Your verification code is:</p>
          <h1 style="background: #eee; padding: 10px; letter-spacing: 5px; display: inline-block;">${code}</h1>
          <p>This code expires in 10 minutes.</p>
        </div>
      `
    };

    logger.info(`Attempting email transmission...`);
    const info = await transporter.sendMail(mailOptions);
    
    logger.info("✅ SMTP SUCCESS: Email sent successfully.", { 
        messageId: info.messageId,
        response: info.response
    });
    return { success: true };

  } catch (mailError) {
    logger.error("❌ EMAIL FAILED", {
        errorMessage: mailError.message,
        stack: mailError.stack
    });
    throw new HttpsError("internal", "Failed to send email. Please try again or contact support.");
  }
});

exports.verifyAuthCode = onCall({ cors: true }, async (request) => {
    const emailInput = request.data.email;
    logger.info("EXECUTION START: verifyAuthCode", { email: maskEmail(emailInput) });

    const { email, code } = request.data;
    if (!email || !code) {
        logger.warn("Missing data in verify request");
        return { valid: false, message: "Missing data" };
    }

    const docId = email.toLowerCase();
    const docRef = db.collection("email_verifications").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
        logger.warn(`Verification failed: No code found for ${maskEmail(email)}`);
        return { valid: false, message: "Code not found or expired" };
    }

    const record = doc.data();
    
    if (Date.now() > record.expiresAt) {
        logger.warn(`Verification failed: Code expired for ${maskEmail(email)}`);
        return { valid: false, message: "Code expired" };
    }
    
    if (record.code !== code) {
        logger.warn(`Verification failed: Invalid code entered for ${maskEmail(email)}`);
        return { valid: false, message: "Invalid code" };
    }

    await docRef.delete();
    logger.info(`✅ VERIFICATION SUCCESSFUL for ${maskEmail(email)}`);
    return { valid: true };
});

// --- INVITATION CODE SYSTEM ---

exports.validateInvitationCode = onCall({ cors: true }, async (request) => {
    logger.info("EXECUTION START: validateInvitationCode");
    
    const { code } = request.data;
    if (!code) {
        throw new HttpsError("invalid-argument", "Code is required.");
    }

    const clientIp = getClientIp(request);

    // IP Rate Limiting: 5 attempts per 10 minutes
    await checkRateLimit(clientIp, 'validate_invitation', 5, 600);

    const codeRef = db.collection("invitation_codes").doc(code);
    
    try {
        const result = await db.runTransaction(async (t) => {
            const doc = await t.get(codeRef);
            
            if (!doc.exists) {
                throw new HttpsError("not-found", "Invalid invitation code.");
            }
            
            const data = doc.data();
            
            if (data.status !== 'active') {
                throw new HttpsError("failed-precondition", "This code has already been used or is currently being registered.");
            }
            
            // Reserve the code
            t.update(codeRef, {
                status: 'reserved',
                reservedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return { valid: true };
        });
        
        logger.info(`✅ Code validated and reserved.`);
        return result;

    } catch (e) {
        logger.warn(`Validation failed for code: ${e.message}`);
        if (e instanceof HttpsError) throw e;
        throw new HttpsError("internal", "Validation process failed.");
    }
});

// --- SCORING ENGINE ---

const DEFAULT_POINTS = {
  grandPrixFinish: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
  sprintFinish: [8, 7, 6, 5, 4, 3, 2, 1],
  fastestLap: 3,
  gpQualifying: [3, 2, 1],
  sprintQualifying: [3, 2, 1],
};

const getDriverPoints = (driverId, resultList, pointsList) => {
    if (!driverId || !resultList || !pointsList) return 0;
    const idx = resultList.indexOf(driverId);
    return idx !== -1 ? (pointsList[idx] || 0) : 0;
};

const calculateEventScore = (picks, results, system, drivers) => {
    if (!picks || !results) return { total: 0, breakdown: { gp: 0, sprint: 0, quali: 0, fl: 0 } };

    const getTeamId = (driverId) => {
        if(results.driverTeams && results.driverTeams[driverId]) return results.driverTeams[driverId];
        const d = drivers.find(drv => drv.id === driverId);
        return d ? d.constructorId : null;
    };

    let gpPoints = 0, sprintPoints = 0, qualiPoints = 0, flPoints = 0;

    // 1. Team Scores
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

    // 2. Driver Scores
    const driverIds = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean);
    driverIds.forEach(dId => {
        gpPoints += getDriverPoints(dId, results.grandPrixFinish, system.grandPrixFinish);
        sprintPoints += getDriverPoints(dId, results.sprintFinish, system.sprintFinish);
        qualiPoints += getDriverPoints(dId, results.gpQualifying, system.gpQualifying);
        qualiPoints += getDriverPoints(dId, results.sprintQualifying, system.sprintQualifying);
    });

    // 3. Fastest Lap
    if (picks.fastestLap && picks.fastestLap === results.fastestLap) {
        flPoints += system.fastestLap;
    }

    let total = gpPoints + sprintPoints + qualiPoints + flPoints;

    // 4. Penalties
    if (picks.penalty && picks.penalty > 0) {
        const deduction = Math.ceil(total * picks.penalty);
        total -= deduction;
    }

    return { total, breakdown: { gp: gpPoints, sprint: sprintPoints, quali: qualiPoints, fl: flPoints } };
};

exports.updateLeaderboard = onDocumentWritten(
    { 
        document: 'app_state/race_results',
        memory: "512MiB",
        timeoutSeconds: 300 // 5 minutes
    }, 
    async (event) => {
        if (!event.data || !event.data.after.exists) return;
        
        const raceResults = event.data.after.data();
        
        const [usersSnap, scoringSnap, entitiesSnap] = await Promise.all([
            db.collection('userPicks').get(),
            db.collection('app_state').doc('scoring_config').get(),
            db.collection('app_state').doc('entities').get()
        ]);

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

        let driversList = [];
        if (entitiesSnap.exists && entitiesSnap.data().drivers) {
            driversList = entitiesSnap.data().drivers;
        }

        logger.info(`(v2) Starting leaderboard calculation for ${usersSnap.size} users...`);
        
        const leaderboardData = [];

        usersSnap.forEach(doc => {
            const userId = doc.id;
            const allPicks = doc.data();
            let totalPoints = 0;
            let breakdown = { gp: 0, sprint: 0, quali: 0, fl: 0 };

            Object.keys(allPicks).forEach(eventId => {
                const result = raceResults[eventId];
                if (result) {
                    const systemToUse = result.scoringSnapshot || pointsSystem;
                    const score = calculateEventScore(allPicks[eventId], result, systemToUse, driversList);
                    totalPoints += score.total;
                    breakdown.gp += score.breakdown.gp;
                    breakdown.sprint += score.breakdown.sprint;
                    breakdown.quali += score.breakdown.quali;
                    breakdown.fl += score.breakdown.fl;
                }
            });
            leaderboardData.push({ userId, totalPoints, breakdown });
        });

        leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);

        const chunkArray = (array, size) => {
            const chunked = [];
            for (let i = 0; i < array.length; i += size) {
                chunked.push(array.slice(i, i + size));
            }
            return chunked;
        };

        const batches = chunkArray(leaderboardData, 450);
        let writeCount = 0;

        for (const batchItems of batches) {
            const batch = db.batch();
            batchItems.forEach((user, index) => {
                const rank = writeCount + index + 1;
                const ref = db.collection('public_users').doc(user.userId);
                batch.set(ref, { 
                    totalPoints: user.totalPoints,
                    rank: rank,
                    breakdown: user.breakdown,
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            await batch.commit();
            writeCount += batchItems.length;
        }

        logger.info(`(v2) Leaderboard updated. Processed ${writeCount} users.`);
    }
);
