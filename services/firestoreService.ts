
import { db } from './firebase.ts';
// Fix: Add query and orderBy to support sorted data fetching for donations.
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, orderBy, addDoc, Timestamp, runTransaction, deleteDoc, writeBatch, serverTimestamp, where } from '@firebase/firestore';
// Fix: Import the newly created Donation type.
import { PickSelection, User, RaceResults, Donation, ScoringSettingsDoc, Driver, Constructor, EventSchedule, InvitationCode } from '../types.ts';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { User as FirebaseUser } from '@firebase/auth';
import { EVENTS } from '../constants.ts';

// User Profile Management
export const createUserProfileDocument = async (userAuth: FirebaseUser, additionalData: { displayName: string; firstName: string; lastName: string; invitationCode?: string }) => {
    if (!userAuth) return;
    const userRef = doc(db, 'users', userAuth.uid);
    const publicUserRef = doc(db, 'public_users', userAuth.uid);
    const userPicksRef = doc(db, 'userPicks', userAuth.uid);

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists()) {
                const { email } = userAuth;
                const { displayName, firstName, lastName, invitationCode } = additionalData;

                // Atomic write 1: Private User Profile (contains PII)
                transaction.set(userRef, {
                    displayName,
                    email,
                    firstName,
                    lastName,
                    invitationCode: invitationCode || null,
                    duesPaidStatus: 'Unpaid',
                });

                // Atomic write 2: Public User Profile (Safe for Leaderboard)
                transaction.set(publicUserRef, {
                    displayName,
                    // We can add photoURL or other non-sensitive data here later
                });

                // Atomic write 3: Empty Picks Document
                // We check availability via the transaction to ensure we don't overwrite if it was created milliseconds ago
                transaction.set(userPicksRef, {});

                // Atomic write 4: Mark Invitation Code as Used (if present)
                if (invitationCode) {
                    const invRef = doc(db, 'invitation_codes', invitationCode);
                    transaction.update(invRef, {
                        status: 'used',
                        usedBy: userAuth.uid,
                        usedByEmail: email,
                        usedAt: serverTimestamp()
                    });
                }
            }
        });
    } catch (error) {
        console.error("Error creating user profile or picks document via transaction", error);
        throw error;
    }
    return userRef;
};

export const getUserProfile = async (uid: string): Promise<User | null> => {
    const userRef = doc(db, 'users', uid);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
        return { id: uid, ...snapshot.data() } as User;
    }
    return null;
};

export const updateUserProfile = async (uid: string, data: { displayName: string; email: string; firstName?: string; lastName?: string }) => {
    const userRef = doc(db, 'users', uid);
    const publicUserRef = doc(db, 'public_users', uid);
    
    try {
        // Use a batch to ensure both private and public records update atomically
        const batch = writeBatch(db);
        
        // Update private record
        batch.update(userRef, data);
        
        // Update/Sync public fields (merge ensures we don't wipe points/rank)
        batch.set(publicUserRef, { displayName: data.displayName }, { merge: true });
        
        await batch.commit();
        console.log(`Profile updated for user ${uid}`);
    } catch (error) {
        console.error("Error updating user profile", error);
        throw error;
    }
};

export const updateUserDuesStatus = async (uid: string, status: 'Paid' | 'Unpaid') => {
    const userRef = doc(db, 'users', uid);
    try {
        await updateDoc(userRef, { duesPaidStatus: status });
        console.log(`Dues status for user ${uid} updated to ${status}`);
    } catch (error) {
        console.error("Error updating dues status", error);
        throw error;
    }
};

export const updateUserAdminStatus = async (uid: string, isAdmin: boolean) => {
    const userRef = doc(db, 'users', uid);
    try {
        await updateDoc(userRef, { isAdmin });
        console.log(`Admin status for user ${uid} updated to ${isAdmin}`);
    } catch (error) {
        console.error("Error updating admin status", error);
        throw error;
    }
};

// Admin Only: Fetches full user details from the secure 'users' collection
export const getAllUsers = async (): Promise<User[]> => {
    try {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        const users: User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        return users;
    } catch (error) {
        console.error("Error fetching all users (Admin). Ensure you have admin privileges.", error);
        return [];
    }
};

// Public Access: Fetches sanitized user details for Leaderboard from 'public_users'
export const getAllUsersAndPicks = async (): Promise<{ users: User[], allPicks: { [userId: string]: { [eventId: string]: PickSelection } }, source: 'public' | 'private_fallback' }> => {
    try {
        const publicUsersCollection = collection(db, 'public_users');
        const userPicksCollection = collection(db, 'userPicks');

        const [usersSnapshot, userPicksSnapshot] = await Promise.all([
            getDocs(publicUsersCollection),
            getDocs(userPicksCollection)
        ]);

        let source: 'public' | 'private_fallback' = 'public';

        // Map public users to User type (missing email/private fields is expected here)
        let users: User[] = usersSnapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            email: '', // Safe default
            duesPaidStatus: undefined,
            isAdmin: false
        } as User));

        // Fallback: If public_users is empty, try fetching 'users' (Admin only will succeed/have data)
        // This handles the case where migration hasn't run yet, allowing Admin to see data immediately.
        if (users.length === 0) {
            try {
                const privateUsersCollection = collection(db, 'users');
                const privateSnapshot = await getDocs(privateUsersCollection);
                if (!privateSnapshot.empty) {
                    console.warn("Leaderboard fetching from 'users' collection (Fallback). Migration recommended.");
                    users = privateSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as User));
                    source = 'private_fallback';
                }
            } catch (e) {
                // Ignore permission errors (regular users cannot read 'users' collection list)
            }
        }

        const allPicks: { [userId: string]: { [eventId: string]: PickSelection } } = {};
        userPicksSnapshot.forEach(doc => {
            allPicks[doc.id] = doc.data() as { [eventId: string]: PickSelection };
        });

        return { users, allPicks, source };
    } catch (error) {
        console.error("Error fetching leaderboard data", error);
        return { users: [], allPicks: {}, source: 'public' };
    }
};

// User Picks Management
export const getUserPicks = async (uid: string): Promise<{ [eventId: string]: PickSelection }> => {
    const picksRef = doc(db, 'userPicks', uid);
    const snapshot = await getDoc(picksRef);
    return snapshot.exists() ? snapshot.data() as { [eventId: string]: PickSelection } : {};
};

export const saveUserPicks = async (uid: string, eventId: string, picks: PickSelection, isAdmin: boolean = false) => {
    // Security Validation: Check submission time
    // Admins can bypass this check if needed
    if (!isAdmin) {
        const event = EVENTS.find(e => e.id === eventId);
        if (event) {
            const lockTime = new Date(event.lockAtUtc).getTime();
            if (Date.now() >= lockTime) {
                 console.warn(`Blocked late submission for ${eventId} by ${uid}`);
                 throw new Error("Picks submission is locked for this event.");
            }
        }
    }

    const picksRef = doc(db, 'userPicks', uid);
    try {
        await setDoc(picksRef, { [eventId]: picks }, { merge: true });
        console.log(`Picks for ${eventId} saved successfully for user ${uid}`);
    } catch (error) {
        console.error("Error saving user picks", error);
        throw error;
    }
};

// New: Update a penalty for a specific pick without overwriting selections
export const updatePickPenalty = async (uid: string, eventId: string, penalty: number, reason: string) => {
    const picksRef = doc(db, 'userPicks', uid);
    try {
        // Use dot notation to update nested fields in Firestore map
        await updateDoc(picksRef, {
            [`${eventId}.penalty`]: penalty,
            [`${eventId}.penaltyReason`]: reason
        });
        console.log(`Penalty updated for ${eventId} user ${uid}`);
    } catch (error) {
        console.error("Error updating penalty", error);
        throw error;
    }
};

// Form Lock Management
export const saveFormLocks = async (locks: { [eventId: string]: boolean }) => {
    const locksRef = doc(db, 'app_state', 'form_locks');
    try {
        await setDoc(locksRef, locks);
        console.log("Form locks saved successfully.");
    } catch (error) {
        console.error("Error saving form locks", error);
        throw error;
    }
};

// Race Results Management
export const saveRaceResults = async (results: RaceResults) => {
    const resultsRef = doc(db, 'app_state', 'race_results');
    try {
        // This will overwrite the entire document with the new results object
        await setDoc(resultsRef, results);
        console.log("Race results saved successfully to Firestore.");
    // Fix: Added missing opening brace for the catch block to correct the syntax.
    } catch (error) {
        console.error("Error saving race results", error);
        throw error;
    }
};

// Points System Management
export const saveScoringSettings = async (settings: ScoringSettingsDoc) => {
    const configRef = doc(db, 'app_state', 'scoring_config');
    try {
        await setDoc(configRef, settings);
        console.log("Scoring settings saved successfully.");
    } catch (error) {
        console.error("Error saving scoring settings", error);
        throw error;
    }
};

// League Entities (Drivers/Teams) Management
export const getLeagueEntities = async (): Promise<{ drivers: Driver[]; constructors: Constructor[] } | null> => {
    const entitiesRef = doc(db, 'app_state', 'entities');
    const snapshot = await getDoc(entitiesRef);
    if (snapshot.exists()) {
        return snapshot.data() as { drivers: Driver[]; constructors: Constructor[] };
    }
    return null;
};

export const saveLeagueEntities = async (drivers: Driver[], constructors: Constructor[]) => {
    const entitiesRef = doc(db, 'app_state', 'entities');
    try {
        await setDoc(entitiesRef, { drivers, constructors });
        console.log("League entities saved successfully.");
    } catch (error) {
        console.error("Error saving league entities", error);
        throw error;
    }
};

// Event Schedule Management
export const getEventSchedules = async (): Promise<{ [eventId: string]: EventSchedule }> => {
    const schedulesRef = doc(db, 'app_state', 'event_schedules');
    const snapshot = await getDoc(schedulesRef);
    if (snapshot.exists()) {
        return snapshot.data() as { [eventId: string]: EventSchedule };
    }
    return {};
};

export const saveEventSchedule = async (eventId: string, schedule: EventSchedule) => {
    const schedulesRef = doc(db, 'app_state', 'event_schedules');
    try {
        // Merge the new schedule for this specific eventId
        await setDoc(schedulesRef, { [eventId]: schedule }, { merge: true });
        console.log(`Schedule saved for ${eventId}.`);
    } catch (error) {
        console.error("Error saving event schedule", error);
        throw error;
    }
};

// Fix: Add and export getUserDonations function. This was missing, causing an import error.
export const getUserDonations = async (uid: string): Promise<Donation[]> => {
    if (!uid) return [];
    // Assumes donations are stored in a subcollection 'donations' under each user document.
    const donationsCollectionRef = collection(db, 'users', uid, 'donations');
    const q = query(donationsCollectionRef, orderBy('createdAt', 'desc'));
    const donationsSnapshot = await getDocs(q);
    const donations = donationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Donation));
    return donations;
};

export const logDuesPaymentInitiation = async (
    user: User, 
    amountInDollars: number, 
    season: string, 
    memo: string
) => {
    if (!user) throw new Error("User must be logged in to initiate a payment.");
    
    const duesPaymentData = {
        uid: user.id,
        email: user.email,
        amount: amountInDollars * 100, // store in cents
        season,
        memo,
        status: 'initiated' as const,
        createdAt: Timestamp.now(),
    };

    try {
        const duesCollectionRef = collection(db, 'dues_payments');
        const docRef = await addDoc(duesCollectionRef, duesPaymentData);
        console.log("Dues payment initiation logged with ID: ", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Error logging dues payment initiation:", error);
        throw error;
    }
};

// --- Invitation Code Management (Admin) ---

export const getInvitationCodes = async (): Promise<InvitationCode[]> => {
    const codesRef = collection(db, 'invitation_codes');
    // Order by created descending
    const q = query(codesRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
        code: doc.id,
        ...doc.data()
    } as InvitationCode));
};

export const createInvitationCode = async (adminUid: string): Promise<string> => {
    const code = `FF1-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const codeRef = doc(db, 'invitation_codes', code);
    
    await setDoc(codeRef, {
        status: 'active',
        createdAt: serverTimestamp(),
        createdBy: adminUid
    });
    
    return code;
};

export const createBulkInvitationCodes = async (adminUid: string, count: number): Promise<void> => {
    const batch = writeBatch(db);
    
    for (let i = 0; i < count; i++) {
        const code = `FF1-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const codeRef = doc(db, 'invitation_codes', code);
        batch.set(codeRef, {
            status: 'active',
            createdAt: serverTimestamp(),
            createdBy: adminUid
        });
    }
    
    await batch.commit();
};