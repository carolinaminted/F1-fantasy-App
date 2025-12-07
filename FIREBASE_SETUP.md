# 🏎️ Formula One Fantasy App — Backend Setup Guide

Use this guide to connect your local application to your newly provisioned Firebase project.

## 1. Credentials Setup

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Open your project.
3.  Navigate to **Project settings** (gear icon) > **General** > **Your apps**.
4.  Under the "Firebase SDK snippet" section, select **Config**.
5.  Copy the `const firebaseConfig = { ... }` object.
6.  Open `firebaseConfig.ts` in your code editor.
7.  Replace the existing `firebaseConfig` object with the one you just copied.

## 2. Enable Authentication

The app uses Firebase Auth to manage users and secure the Admin capabilities.

1.  In the Firebase Console sidebar, click **Build** > **Authentication**.
2.  Click **Get started**.
3.  Select the **Sign-in method** tab.
4.  Click **Email/Password**.
5.  **Enable** the "Email/Password" toggle. (Leave "Email link" disabled).
6.  Click **Save**.

## 3. Enable Firestore Database

1.  In the sidebar, click **Build** > **Firestore Database**.
2.  Click **Create database**.
3.  **Important:** Select **Start in production mode**.
4.  Choose a location (e.g., `nam5 (us-central)`).
5.  Click **Enable**.

## 4. Configure Security Rules (Critical)

These rules determine who is an Admin and who can edit picks.

1.  Go to the **Rules** tab in the Firestore panel.
2.  Delete the default rules and paste the following exactly:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // --- Helper Functions ---
    
    // Checks if the user has the specific admin email address in their profile
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.email == 'admin@fantasy.f1';
    }
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    // --- Collections ---

    // 1. User Profiles
    // Users can create their own profile.
    // Admins can update 'duesPaidStatus'.
    // Owners can update other fields.
    match /users/{userId} {
      allow read: if true;
      allow create: if isOwner(userId);
      allow update: if (isOwner(userId) && !('duesPaidStatus' in request.resource.data.diff(resource.data).changedKeys())) ||
                     (isAdmin() && request.resource.data.diff(resource.data).changedKeys().hasOnly(['duesPaidStatus']));
    }
    
    // 2. User Picks
    // Public read (for leaderboard transparency).
    // Owner write only.
    match /userPicks/{userId} {
       allow read: if true;
       allow write: if isOwner(userId);
    }
    
    // 3. Dues Payments
    // Users can create payment logs. Admins can view them.
    match /dues_payments/{paymentId} {
      allow read: if isAdmin();
      allow create: if isOwner(request.resource.data.uid);
    }

    // 4. Global App State (Race Results & Locks)
    // Authenticated users can read (to see results/locks).
    // Only Admin can write (to update results/locks).
    match /app_state/{document} {
       allow read: if isSignedIn();
       allow write: if isAdmin();
    }
    
    // 5. User Donations (Subcollection)
    // Users can read their own donations.
    match /users/{userId}/donations/{donationId} {
        allow read: if isOwner(userId);
        // Creation is usually handled by backend/extensions, 
        // but if client-side logging is needed:
        allow create: if isOwner(userId); 
    }
  }
}
```
3.  Click **Publish**.

## 5. Bootstrap the Admin User

The app's logic relies on a user with the specific email `admin@fantasy.f1` existing in the database to unlock Admin features.

1.  Start your application locally (`npm start` or equivalent).
2.  On the Login screen, click the **Formula Fantasy Logo** (this is a dev shortcut) OR toggle to "Sign Up".
3.  **Sign Up** with these exact credentials:
    *   **Display Name:** `Admin Principal` (or similar)
    *   **Email:** `admin@fantasy.f1`
    *   **Password:** (Any secure password you choose)
4.  Once registered, the app will detect your email and unlock the **Admin** tile on the dashboard.

## 6. Seed Initial Data

The application is smart enough to seed the database if it detects missing data.

1.  **Race Results:** Just by logging in and loading the dashboard, the app checks `app_state/race_results`. If missing, it uploads the default 2025 calendar and results from `constants.ts`.
2.  **Form Locks:** Similarly, it checks `app_state/form_locks`. If missing, it creates a default unlocked state.

You are now fully connected! 🚀
