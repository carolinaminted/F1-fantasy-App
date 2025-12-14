
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

// --- DIAGNOSTICS ---

exports.ping = onCall((request) => {
    return { message: "pong (v2)", timestamp: Date.now() };
});

// --- EMAIL VERIFICATION ---

exports.sendAuthCode = onCall({ cors: true }, async (request) => {
  logger.info("EXECUTION START: sendAuthCode", { triggerData: request.data });

  const email = request.data.email;
  if (!email) {
    logger.error("Missing email in request");
    throw new HttpsError("invalid-argument", "Email is required");
  }

  // 1. Config Loading (V2 Compatible)
  let gmailEmail = process.env.EMAIL_USER || process.env.GMAIL_USER || "your-email@gmail.com";
  let gmailPassword = process.env.EMAIL_PASS || process.env.GMAIL_PASS || "your-app-password";
  
  // Production Flag: Set ENABLE_DEMO_MODE="true" in Cloud Run env vars to enable the fallback
  const enableDemoMode = process.env.ENABLE_DEMO_MODE === 'true';
  
  const isDefaultUser = gmailEmail === "your-email@gmail.com";
  const isDefaultPass = gmailPassword === "your-app-password";
  
  logger.info("SMTP Configuration Check", {
      configuredUser: isDefaultUser ? "DEFAULT (Not Set)" : "Configured", // Obfuscated for logs
      isConfigValid: !isDefaultUser && !isDefaultPass,
      demoModeAllowed: enableDemoMode
  });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 600000; // 10 minutes

  // 2. Write to Firestore
  try {
    // Sanitize email for doc ID
    const docId = email.toLowerCase(); 
    
    await db.collection("email_verifications").doc(docId).set({
      code: code,
      email: email, 
      expiresAt: expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // SECURITY: Only log the code if explicitly in Demo Mode, otherwise keep logs clean.
    if (enableDemoMode) {
        logger.info(`>>> DEMO MODE: GENERATED CODE FOR ${email}: ${code} <<<`);
    }

  } catch (dbError) {
      logger.error("❌ FIRESTORE WRITE FAILED", dbError);
      throw new HttpsError("internal", "Database error: Unable to save verification code.");
  }

  // 3. Demo Mode / Missing Config Check
  if (isDefaultUser || isDefaultPass) {
      if (enableDemoMode) {
          logger.warn(">>> DEMO MODE ACTIVE: Email verification skipped due to missing config. Returning code to client. <<<");
          return { success: true, demoMode: true, code: code };
      } else {
          logger.error("SMTP Config missing and Demo Mode is disabled.");
          throw new HttpsError("failed-precondition", "Email service is not configured. Please contact support.");
      }
  }

  // 4. Send Email
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
    logger.info("EXECUTION START: verifyAuthCode", { email: request.data.email });

    const { email, code } = request.data;
    if (!email || !code) {
        logger.warn("Missing data in verify request");
        return { valid: false, message: "Missing data" };
    }

    const docId = email.toLowerCase();
    const docRef = db.collection("email_verifications").doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
        logger.warn(`Verification failed: No code found for ${email}`);
        return { valid: false, message: "Code not found or expired" };
    }

    const record = doc.data();
    
    // Check Expiry
    if (Date.now() > record.expiresAt) {
        logger.warn(`Verification failed: Code expired for ${email}`);
        return { valid: false, message: "Code expired" };
    }
    
    // Check Match
    if (record.code !== code) {
        logger.warn(`Verification failed: Invalid code entered for ${email}`);
        return { valid: false, message: "Invalid code" };
    }

    // Success - Clean up used code
    await docRef.delete();
    logger.info(`✅ VERIFICATION SUCCESSFUL for ${email}`);
    return { valid: true };
});

// --- INVITATION CODE SYSTEM ---

exports.validateInvitationCode = onCall({ cors: true }, async (request) => {
    logger.info("EXECUTION START: validateInvitationCode", { data: request.data });
    
    const { code } = request.data;
    
    if (!code) {
        throw new HttpsError("invalid-argument", "Code is required.");
    }

    const codeRef = db.collection("invitation_codes").doc(code);
    
    try {
        const result = await db.runTransaction(async (t) => {
            const doc = await t.get(codeRef);
            
            if (!doc.exists) {
                throw new HttpsError("not-found", "Invalid invitation code.");
            }
            
            const data = doc.data();
            
            if (data.status !== 'active') {
                // If it's reserved, check if it expired (e.g. 15 mins ago). 
                // For simplicity in this iteration, we treat reserved as used/taken to be safe.
                throw new HttpsError("failed-precondition", "This code has already been used or is currently being registered.");
            }
            
            // Reserve the code so no one else can grab it while this user completes signup
            t.update(codeRef, {
                status: 'reserved',
                reservedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return { valid: true };
        });
        
        logger.info(`✅ Code ${code} validated and reserved.`);
        return result;

    } catch (e) {
        logger.warn(`Validation failed for code ${code}: ${e.message}`);
        // Re-throw instance of HttpsError so client gets correct code
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

/**
 * Trigger: Recalculate Leaderboard
 * V2 Config: Increased memory and timeout for heavy calculations
 */
exports.updateLeaderboard = onDocumentWritten(
    { 
        document: 'app_state/race_results',
        memory: "512MiB",
        timeoutSeconds: 300 // 5 minutes
    }, 
    async (event) => {
        // In v2, we check event.data.after
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