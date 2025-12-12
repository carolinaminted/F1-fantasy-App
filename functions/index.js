
/**
 * Firebase Cloud Functions for F1 Fantasy League
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// Configure your email transport
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "your-email@gmail.com", // Replace with your email
    pass: "your-app-password",    // Replace with your app password
  },
});

exports.sendVerificationCode = functions.https.onCall(async (data, context) => {
  const email = data.email;
  if (!email) {
    throw new functions.https.HttpsError("invalid-argument", "Email is required");
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Expiration (10 minutes)
  const expiresAt = admin.firestore.Timestamp.now().toMillis() + 600000;

  try {
    // Store code in Firestore (protected collection)
    await db.collection("email_verifications").doc(email).set({
      code: code,
      expiresAt: expiresAt,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Send Email
    const mailOptions = {
      from: '"F1 Fantasy League" <noreply@f1fantasy.com>',
      to: email,
      subject: "Your F1 Fantasy Verification Code",
      text: `Welcome to the Paddock! Your verification code is: ${code}. This code expires in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2 style="color: #DA291C;">F1 Fantasy League</h2>
          <p>Welcome to the Paddock!</p>
          <p>Your verification code is:</p>
          <h1 style="letter-spacing: 5px; background: #eee; padding: 10px; display: inline-block;">${code}</h1>
          <p>This code expires in 10 minutes.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true, message: "Verification code sent" };

  } catch (error) {
    console.error("Error sending email:", error);
    throw new functions.https.HttpsError("internal", "Failed to send email");
  }
});

exports.verifyVerificationCode = functions.https.onCall(async (data, context) => {
    const { email, code } = data;
    if (!email || !code) {
        throw new functions.https.HttpsError("invalid-argument", "Email and Code required");
    }

    const docRef = db.collection("email_verifications").doc(email);
    const doc = await docRef.get();

    if (!doc.exists) {
        return { valid: false, message: "Code not found" };
    }

    const record = doc.data();
    const now = Date.now();

    if (now > record.expiresAt) {
        return { valid: false, message: "Code expired" };
    }

    if (record.code !== code) {
        return { valid: false, message: "Invalid code" };
    }

    // Success - delete the code so it can't be reused
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

const calculatePoints = (picks, results, system, drivers) => {
    if (!picks || !results) return 0;
    
    // Helper to find constructor. Uses snapshot if available, else driver list fallback.
    const getTeamId = (driverId) => {
        if(results.driverTeams && results.driverTeams[driverId]) return results.driverTeams[driverId];
        // Basic fallback if snapshot missing
        return null; 
    };

    let rawTotal = 0;

    // Helper: Score a driver for a specific category
    const getDriverPoints = (driverId, resultList, pointsList) => {
        if (!driverId || !resultList || !pointsList) return 0;
        const idx = resultList.indexOf(driverId);
        return idx !== -1 ? (pointsList[idx] || 0) : 0;
    };

    // 1. Team Scores (Sum of both drivers for that team)
    const teamIds = [...(picks.aTeams || []), picks.bTeam].filter(Boolean);
    teamIds.forEach(teamId => {
        // Iterate results to find drivers belonging to this team
        // GP
        results.grandPrixFinish?.forEach((dId, idx) => {
            if(dId && getTeamId(dId) === teamId) rawTotal += (system.grandPrixFinish[idx] || 0);
        });
        // Sprint
        results.sprintFinish?.forEach((dId, idx) => {
            if(dId && getTeamId(dId) === teamId) rawTotal += (system.sprintFinish[idx] || 0);
        });
        // Quali
        results.gpQualifying?.forEach((dId, idx) => {
            if(dId && getTeamId(dId) === teamId) rawTotal += (system.gpQualifying[idx] || 0);
        });
        // Sprint Quali
        results.sprintQualifying?.forEach((dId, idx) => {
            if(dId && getTeamId(dId) === teamId) rawTotal += (system.sprintQualifying[idx] || 0);
        });
    });

    // 2. Driver Scores
    const driverIds = [...(picks.aDrivers || []), ...(picks.bDrivers || [])].filter(Boolean);
    driverIds.forEach(dId => {
        rawTotal += getDriverPoints(dId, results.grandPrixFinish, system.grandPrixFinish);
        rawTotal += getDriverPoints(dId, results.sprintFinish, system.sprintFinish);
        rawTotal += getDriverPoints(dId, results.gpQualifying, system.gpQualifying);
        rawTotal += getDriverPoints(dId, results.sprintQualifying, system.sprintQualifying);
    });

    // 3. Fastest Lap
    if (picks.fastestLap && picks.fastestLap === results.fastestLap) {
        rawTotal += system.fastestLap;
    }

    // 4. Penalties
    if (picks.penalty && picks.penalty > 0) {
        const deduction = Math.ceil(rawTotal * picks.penalty);
        rawTotal -= deduction;
    }

    return rawTotal;
};

// Trigger: Recalculate Leaderboard when Race Results are updated
exports.updateLeaderboard = functions.firestore
    .document('app_state/race_results')
    .onWrite(async (change, context) => {
        const raceResults = change.after.exists ? change.after.data() : {};
        
        // 1. Fetch Dependencies
        const [usersSnap, scoringSnap] = await Promise.all([
            db.collection('userPicks').get(),
            db.collection('app_state').doc('scoring_config').get()
        ]);

        let pointsSystem = DEFAULT_POINTS;
        if (scoringSnap.exists) {
            const data = scoringSnap.data();
            // Handle new profile structure
            if (data.profiles && data.activeProfileId) {
                const active = data.profiles.find(p => p.id === data.activeProfileId);
                if (active) pointsSystem = active.config;
            } else if (!data.profiles) {
                // Legacy support
                pointsSystem = data;
            }
        }

        console.log("Starting leaderboard calculation...");
        
        // 2. Calculate Scores
        const batch = db.batch();
        let operationCount = 0;
        const usersScores = [];

        usersSnap.forEach(doc => {
            const userId = doc.id;
            const allPicks = doc.data();
            let totalPoints = 0;

            Object.keys(allPicks).forEach(eventId => {
                // Determine system to use: Snapshot or Global Active
                const result = raceResults[eventId];
                if (result) {
                    const systemToUse = result.scoringSnapshot || pointsSystem;
                    totalPoints += calculatePoints(allPicks[eventId], result, systemToUse);
                }
            });

            usersScores.push({ userId, totalPoints });
        });

        // 3. Sort & Assign Ranks
        usersScores.sort((a, b) => b.totalPoints - a.totalPoints);

        usersScores.forEach((user, index) => {
            const publicUserRef = db.collection('public_users').doc(user.userId);
            batch.set(publicUserRef, { 
                totalPoints: user.totalPoints,
                rank: index + 1,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            operationCount++;
            // Firestore batches limit 500
            if (operationCount >= 450) {
                console.log("Committing batch...");
                batch.commit(); // Note: Ideally handle promises for multiple batches
                operationCount = 0;
            }
        });

        if (operationCount > 0) {
            await batch.commit();
        }

        console.log(`Leaderboard updated for ${usersScores.length} users.`);
    });
