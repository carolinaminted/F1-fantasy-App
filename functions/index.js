/**
 * Firebase Cloud Functions for F1 Fantasy League
 * 
 * To deploy:
 * 1. Initialize Firebase Functions in your local project (`firebase init functions`)
 * 2. Replace this file content in `functions/index.js`
 * 3. Run `npm install nodemailer` inside the functions directory.
 * 4. Run `firebase deploy --only functions`
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();

// Configure your email transport
// For Gmail: You need to use an "App Password" if 2FA is enabled.
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