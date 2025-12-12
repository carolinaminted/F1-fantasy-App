/**
 * Firebase Cloud Functions for F1 Fantasy League
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// --- CONFIGURATION ---
// Replace with your actual email credentials using Firebase Environment Config for security in production
// Command: firebase functions:config:set email.user="you@gmail.com" email.pass="app-password"
const gmailEmail = functions.config().email ? functions.config().email.user : "your-email@gmail.com";
const gmailPassword = functions.config().email ? functions.config().email.pass : "your-app-password";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,
    pass: gmailPassword,
  },
});

// --- EMAIL VERIFICATION ---

exports.sendVerificationCode = functions.https.onCall(async (data, context) => {
  const email = data.email;
  if (!email) {
    throw new functions.https.HttpsError("invalid-argument", "Email is required");
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 600000; // 10 minutes

  try {
    await db.collection("email_verifications").doc(email).set({
      code: code,
      expiresAt: expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const mailOptions = {
      from: '"F1 Fantasy League" <noreply@f1fantasy.com>',
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

    await transporter.sendMail(mailOptions);
    return { success: true };

  } catch (error) {
    console.error("Email error:", error);
    // Determine if we are in a configured environment or local dev without creds
    if (gmailEmail === "your-email@gmail.com") {
        console.warn("Email credentials not configured. Returning success for DEMO mode.");
        return { success: true, demoMode: true, code: code }; // Only for dev/demo!
    }
    throw new functions.https.HttpsError("internal", "Failed to send email");
  }
});

exports.verifyVerificationCode = functions.https.onCall(async (data, context) => {
    const { email, code } = data;
    if (!email || !code) return { valid: false, message: "Missing data" };

    const docRef = db.collection("email_verifications").doc(email);
    const doc = await docRef.get();

    if (!doc.exists) return { valid: false, message: "Code not found" };

    const record = doc.data();
    if (Date.now() > record.expiresAt) return { valid: false, message: "Expired" };
    if (record.code !== code) return { valid: false, message: "Invalid code" };

    await docRef.delete();
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

// NOTE: This must mirror the logic in `services/scoringService.ts` exactly.
const calculateEventScore = (picks, results, system, drivers) => {
    if (!picks || !results) return { total: 0, breakdown: { gp: 0, sprint: 0, quali: 0, fl: 0 } };

    // Helper to find constructor. Uses snapshot if available, else driver list fallback.
    const getTeamId = (driverId) => {
        if(results.driverTeams && results.driverTeams[driverId]) return results.driverTeams[driverId];
        // Fallback: Find in current drivers list
        const d = drivers.find(drv => drv.id === driverId);
        return d ? d.constructorId : null;
    };

    let gpPoints = 0;
    let sprintPoints = 0;
    let qualiPoints = 0;
    let flPoints = 0;

    // --- 1. Team Scores (Sum of both drivers for that team) ---
    const teamIds = [...(picks.aTeams || []), picks.bTeam].filter(Boolean);
    
    // We scan the RESULT lists and attribute points to the team if their drivers are in it
    // This is more efficient than scanning drivers and looking up results
    
    // GP Results
    results.grandPrixFinish?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) gpPoints += (system.grandPrixFinish[idx] || 0);
    });
    // Sprint Results
    results.sprintFinish?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) sprintPoints += (system.sprintFinish[idx] || 0);
    });
    // Quali Results (GP + Sprint Quali bucketed together for simplicity)
    results.gpQualifying?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) qualiPoints += (system.gpQualifying[idx] || 0);
    });
    results.sprintQualifying?.forEach((dId, idx) => {
        if (dId && teamIds.includes(getTeamId(dId))) qualiPoints += (system.sprintQualifying[idx] || 0);
    });

    // --- 2. Driver Scores ---
    const driverIds = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean);
    driverIds.forEach(dId => {
        gpPoints += getDriverPoints(dId, results.grandPrixFinish, system.grandPrixFinish);
        sprintPoints += getDriverPoints(dId, results.sprintFinish, system.sprintFinish);
        qualiPoints += getDriverPoints(dId, results.gpQualifying, system.gpQualifying);
        qualiPoints += getDriverPoints(dId, results.sprintQualifying, system.sprintQualifying);
    });

    // --- 3. Fastest Lap ---
    if (picks.fastestLap && picks.fastestLap === results.fastestLap) {
        flPoints += system.fastestLap;
    }

    let total = gpPoints + sprintPoints + qualiPoints + flPoints;

    // --- 4. Penalties ---
    if (picks.penalty && picks.penalty > 0) {
        const deduction = Math.ceil(total * picks.penalty);
        total -= deduction;
    }

    return {
        total,
        breakdown: {
            gp: gpPoints,
            sprint: sprintPoints,
            quali: qualiPoints,
            fl: flPoints
        }
    };
};

/**
 * Trigger: Recalculate Leaderboard when Race Results are updated
 * Optimized to perform batched writes and calculate breakdown stats.
 */
exports.updateLeaderboard = functions.firestore
    .document('app_state/race_results')
    .onWrite(async (change, context) => {
        const raceResults = change.after.exists ? change.after.data() : {};
        
        // 1. Fetch all necessary data
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
                pointsSystem = data; // Legacy
            }
        }

        let driversList = [];
        if (entitiesSnap.exists && entitiesSnap.data().drivers) {
            driversList = entitiesSnap.data().drivers;
        }

        console.log(`Starting leaderboard calculation for ${usersSnap.size} users...`);
        
        const leaderboardData = [];

        // 2. Calculate Scores for every user
        usersSnap.forEach(doc => {
            const userId = doc.id;
            const allPicks = doc.data();
            
            let totalPoints = 0;
            let breakdown = { gp: 0, sprint: 0, quali: 0, fl: 0 };

            Object.keys(allPicks).forEach(eventId => {
                const result = raceResults[eventId];
                // Only score if results exist for this event
                if (result) {
                    // Use snapshot scoring if available in result, otherwise global active
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

        // 3. Sort by Points (Descending)
        leaderboardData.sort((a, b) => b.totalPoints - a.totalPoints);

        // 4. Batch Write to 'public_users'
        // Firestore batch limit is 500 operations. We chunk the array.
        const chunkArray = (array, size) => {
            const chunked = [];
            for (let i = 0; i < array.length; i += size) {
                chunked.push(array.slice(i, i + size));
            }
            return chunked;
        };

        const batches = chunkArray(leaderboardData, 450); // Safe limit
        let writeCount = 0;

        for (const batchItems of batches) {
            const batch = db.batch();
            batchItems.forEach((user, index) => {
                // Determine absolute rank based on index in sorted array + accumulated offset
                const rank = writeCount + index + 1;
                
                const ref = db.collection('public_users').doc(user.userId);
                batch.set(ref, { 
                    totalPoints: user.totalPoints,
                    rank: rank,
                    breakdown: user.breakdown, // Store the breakdown!
                    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            });
            await batch.commit();
            writeCount += batchItems.length;
        }

        console.log(`Leaderboard updated successfully. Processed ${writeCount} users.`);
    });
