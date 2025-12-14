# Maintenance & Repair Scripts

## PII Security Migration (Public Leaderboard Repair)

**Purpose:**
This script copies `displayName` from the secure `users` collection (private PII) to the `public_users` collection.
The application now handles this automatically on sign-up and profile update. 
**Only run this script manually if:**
1. You have legacy users from before the privacy update (Feb 2026) who are missing from the leaderboard.
2. The `public_users` collection was accidentally deleted or corrupted.

**Implementation:**
To use this, temporarily paste the following function into `services/firestoreService.ts`, expose it, and trigger it via the browser console or a temporary button.

```typescript
import { collection, getDocs, writeBatch, doc } from '@firebase/firestore';
import { db } from './firebase.ts';

export const migrateUsersToPublic = async () => {
    console.log("Starting PII Security Migration...");
    try {
        const usersCollection = collection(db, 'users');
        const snapshot = await getDocs(usersCollection);
        console.log(`Found ${snapshot.size} private user records to process.`);
        
        // Chunking logic to avoid Firestore 500 operation limit per batch
        const chunkArray = (array: any[], size: number) => {
            const chunked = [];
            for (let i = 0; i < array.length; i += size) {
                chunked.push(array.slice(i, i + size));
            }
            return chunked;
        };

        const docs = snapshot.docs;
        // Batch limit is 500, use 450 to be safe
        const batches = chunkArray(docs, 450);
        let count = 0;

        for (const batchDocs of batches) {
            const batch = writeBatch(db);
            batchDocs.forEach(docSnap => {
                const data = docSnap.data();
                const publicRef = doc(db, 'public_users', docSnap.id);
                // We only copy the Display Name. Everything else (email, payments) stays private.
                batch.set(publicRef, {
                    displayName: data.displayName || 'Unknown User'
                }, { merge: true });
                count++;
            });
            console.log(`Committing batch of ${batchDocs.length}...`);
            await batch.commit();
        }

        console.log(`Migration successful. Synced ${count} users.`);
        return { success: true, count };
    } catch (error) {
        console.error("Migration failed:", error);
        return { success: false, error };
    }
};
```