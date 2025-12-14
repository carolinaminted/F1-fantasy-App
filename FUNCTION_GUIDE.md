
# Cloud Functions User Guide

This document explains the architecture, logic, and testing procedures for the backend Cloud Functions used in the F1 Fantasy League application.

The functions are located in `functions/index.js` and run on Google Cloud Functions (Gen 2).

---

## 1. `ping`

### Overview
A simple diagnostic function used to verify that the backend is reachable and responding.

### Logic
1.  Receives a request from the client.
2.  Immediately returns a JSON object containing the message "pong (v2)" and the server-side timestamp.

### How it is Triggered
*   **Type:** Callable (`onCall`).
*   **Trigger:** It is called directly from the frontend client application (React) using the Firebase SDK `httpsCallable` method.
*   **Usage:** Used during the "Secret Ping Test" in the Auth Screen (clicking the logo multiple times).

### How to Test
1.  Open the App.
2.  Go to the Login Screen.
3.  Click the "F1 Fantasy One" logo 5 times rapidly.
4.  An alert should appear saying "Backend Connected: pong (v2)".

---

## 2. `sendAuthCode`

### Overview
Handles the initiation of the passwordless/verification flow. It generates a 6-digit code, saves it to the database for validation, and attempts to email it to the user.

### Logic
1.  **Validation:** Checks if an email was provided.
2.  **Configuration:** Loads SMTP (Email) credentials from Environment Variables.
3.  **Generation:** Creates a random 6-digit code and sets an expiration time (10 minutes).
4.  **Persistence:** Saves the code, email, and expiration timestamp to the `email_verifications` Firestore collection (document ID is the email).
5.  **Demo Mode Check:** If SMTP credentials are not set (default state), it logs the code to the Google Cloud Console and returns it to the client (for testing purposes).
6.  **Transmission:** If credentials exist, it uses `nodemailer` to send the code to the user's email address.

### How it is Triggered
*   **Type:** Callable (`onCall`).
*   **Trigger:** Called when the user enters their email and clicks "Send Verification Code" on the Sign Up or Login screens.

### How to Test
1.  Go to the Sign Up screen.
2.  Enter a valid email address.
3.  Click "Send Verification Code".
4.  **If Email is Configured:** Check your inbox.
5.  **If Demo Mode:** Open the browser console (F12) or the Cloud Functions logs. The code will be printed there (e.g., `SERVER DEMO MODE: Code is 123456`).

---

## 3. `verifyAuthCode`

### Overview
Validates the code entered by the user against the record created by `sendAuthCode`.

### Logic
1.  **Lookup:** Fetches the document from the `email_verifications` collection using the email as the key.
2.  **Existence Check:** Returns an error if no record is found.
3.  **Expiry Check:** Compares the current server time with the `expiresAt` timestamp in the document. Fails if expired.
4.  **Matching:** Compares the user-submitted code with the stored code.
5.  **Cleanup:** If successful, deletes the verification document to prevent reuse.
6.  **Response:** Returns `{ valid: true }` on success.

### How it is Triggered
*   **Type:** Callable (`onCall`).
*   **Trigger:** Called when the user enters the 6-digit code into the input field and clicks "Verify Code".

### How to Test
1.  Complete the steps for `sendAuthCode`.
2.  Enter the code received (or the demo code).
3.  Click "Verify".
4.  If successful, the UI moves to the "Profile Details" step.

---

## 4. `updateLeaderboard` (Background Trigger)

### Overview
The "Core Engine" of the application. This function automatically recalculates the scores for **every user in the league** whenever race results are updated.

### Logic
1.  **Trigger:** Listens for *any* write operation to the specific Firestore document `app_state/race_results`.
2.  **Data Fetching:**
    *   Fetches the new Race Results.
    *   Fetches *all* user picks from the `userPicks` collection.
    *   Fetches the active Scoring System configuration.
3.  **Calculation Loop:** Iterates through every user:
    *   Calculates points for every race based on their picks and the official results.
    *   Sums up Grand Prix, Sprint, Qualifying, and Fastest Lap points.
    *   Applies penalties if applicable.
4.  **Ranking:** Sorts all users by `totalPoints` descending.
5.  **Batch Write:** Updates the `public_users` collection with the new `totalPoints`, `rank`, and scoring breakdown.
    *   *Note:* Uses batched writes (groups of 450) to handle Firestore limits efficiently.

### How it is Triggered
*   **Type:** Firestore Trigger (`onDocumentWritten`).
*   **Trigger:** Automatic. It runs whenever an Admin saves results in the "Results Manager".

### How to Test
1.  Log in as an Admin.
2.  Go to **Admin > Results Manager**.
3.  Select a race (e.g., "Australian GP").
4.  Enter dummy results (e.g., set Max Verstappen as P1).
5.  Click **Save Results**.
6.  Wait 10-30 seconds (depending on user count).
7.  Go to the **Leaderboard** page. You should see users' points updated to reflect the new results.
