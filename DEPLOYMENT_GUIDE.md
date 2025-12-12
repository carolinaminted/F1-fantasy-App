
# Deployment Guide

## Firestore Security Rules

The following rules must be deployed to ensuring data privacy and integrity.

**Key Policies:**
1.  **Read Access:** Generally open for Leaderboard visibility, but specific user data (like donations) is restricted.
2.  **Write Access:** Strict ownership checks (`isOwner(userId)`). Users can only modify their own data.
3.  **Admin Privileges:** Actions are allowed if the user's profile in Firestore has `isAdmin: true`.
4.  **Field-Level Security:** Users cannot modify their own `duesPaidStatus` or `isAdmin` flags.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // --- Helper Functions ---
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isSignedIn() && (
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true
      );
    }

    // --- User Profiles ---
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create: if isOwner(userId);

      // An update is allowed if:
      // 1. The user is the owner AND they are NOT trying to change their dues status or admin status.
      // 2. The requester is an admin (can change anything).
      allow update: if (isOwner(userId) && !request.resource.data.diff(resource.data).changedKeys().hasAny(['duesPaidStatus', 'isAdmin'])) ||
                     isAdmin();
      
      match /donations/{donationId} {
        allow read: if isOwner(userId) || isAdmin();
        allow create: if isOwner(userId)
                      && request.resource.data.userId == userId
                      && request.resource.data.createdAt == request.time;
        allow update, delete: if false; 
      }
    }
    
    // --- User Picks ---
    match /userPicks/{userId} {
       allow read: if true;
       // Allow owner to submit picks OR Admin to apply penalties/edits
       allow write: if isOwner(userId) || isAdmin();
    }

    // --- Global App State ---
    match /app_state/{document=**} {
       allow read: if isSignedIn();
       allow write: if isAdmin();
    }
    
    // --- Dues Payments ---
    match /dues_payments/{paymentId} {
      allow read: if isAdmin() || (isSignedIn() && resource.data.uid == request.auth.uid);
      allow create: if isSignedIn() && request.resource.data.uid == request.auth.uid;
      allow update, delete: if isAdmin();
    }
  }
}
```

## Deployment Steps

1.  Copy the content above.
2.  Go to the Firebase Console -> Firestore Database -> Rules.
3.  Paste the content and click **Publish**.
4.  Verify that unauthenticated access (e.g. via Incognito window) is blocked where appropriate.
