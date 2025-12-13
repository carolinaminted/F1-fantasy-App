
/**
 * Firebase Cloud Functions for F1 Fantasy League (Gen 2)
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const functions = require("firebase-functions"); // Keep v1 for legacy config access
const logger = functions.logger; // Use standard Firebase logger
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// --- DIAGNOSTICS ---

exports.ping = onCall((request) => {
    return { message: "pong (v2)", timestamp: Date.now() };
});

// --- EMAIL VERIFICATION (Renamed to fix 409 Conflict) ---

exports.sendAuthCode = onCall({ cors: true }, async (request) => {
  logger.info("EXECUTION START: sendAuthCode", { triggerData: request.data });

  const email = request.data.email;
  if (!email) {
    logger.error("Missing email in request");
    throw new HttpsError("invalid-argument", "Email is required");
  }

  // 1. Load Config
  const emailConfig = functions.config().email || {};
  const gmailEmail = emailConfig.user || "your-email@gmail.com";
  const gmailPassword = emailConfig.pass || "your-app-password";
  
  // 2. Debug Config (Masked)
  const isDefaultUser = gmailEmail === "your-email@gmail.com";
  const isDefaultPass = gmailPassword === "your-app-password";
  
  logger.info("SMTP Configuration Check", {
      configuredUser: isDefaultUser ? "DEFAULT (Not Set)" : gmailEmail,
      configuredPass: isDefaultPass ? "DEFAULT (Not Set)" : "********",
      isConfigValid: !isDefaultUser && !isDefaultPass
  });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 600000; // 10 minutes

  try {
    // 3. Write to Firestore
    await db.collection("email_verifications").doc(email).set({
      code: code,
      expiresAt: expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // --- EMERGENCY DEBUGGING LOG ---
    // If email fails, you can find the code in your Google Cloud Logs here:
    logger.info(`>>> GENERATED CODE FOR ${email}: ${code} <<<`);

    // 4. Demo Mode / Missing Config Check
    if (isDefaultUser || isDefaultPass) {
        logger.warn(">>> DEMO MODE ACTIVE: Email verification skipped due to missing config. <<<");
        logger.warn("To fix: Run 'firebase functions:config:set email.user=\"...\" email.pass=\"...\"' and redeploy.");
        return { success: true, demoMode: true, code: code };
    }

    // 5. Send Email
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
    logger.info(`Sender: ${gmailEmail}`);
    logger.info(`Receiver: ${email}`);

    const info = await transporter.sendMail(mailOptions);
    
    logger.info("✅ SMTP SUCCESS: Email sent successfully.", { 
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected
    });
    return { success: true };

  } catch (error) {
    logger.error("❌ CRITICAL FAILURE in sendAuthCode", {
        errorMessage: error.message,
        errorCode: error.code,
        sender: gmailEmail,
        receiver: email,
        stack: error.stack
    });
    throw new HttpsError("internal", "Failed to send email: " + error.message);
  }
});

exports.verifyAuthCode = onCall({ cors: true }, async (request) => {
    const { email, code } = request.data;
    if (!email || !code) return { valid: false, message: "Missing data" };

    const docRef = db.collection("email_verifications").doc(email);
    const doc = await docRef.get();

    if (!doc.exists) return { valid: false, message: "Code not found" };

    const record = doc.data();
    if (Date.now() > record.expiresAt) return { valid: false, message: "Expired" };
    if (record.code !== code) return { valid: false, message: "Invalid code" };

    await docRef.delete();
    logger.info(`Verification successful for ${email}`);
    return { valid: true };
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
