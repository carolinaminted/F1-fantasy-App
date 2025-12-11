
import { db } from './firebase.ts';
// Fix: Add query and orderBy to support sorted data fetching for donations.
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, query, orderBy, addDoc, Timestamp } from '@firebase/firestore';
// Fix: Import the newly created Donation type.
import { PickSelection, User, RaceResults, Donation, ScoringSettingsDoc, Driver, Constructor } from '../types.ts';
// Fix: Use scoped @firebase packages for imports to resolve module errors.
import { User as FirebaseUser } from '@firebase/auth';

// User Profile Management
export const createUserProfileDocument = async (userAuth: FirebaseUser, additionalData: { displayName: string; firstName: string; lastName: string }) => {
    if (!userAuth) return;
    const userRef = doc(db, 'users', userAuth.uid);
    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        const { email } = userAuth;
        const { displayName, firstName, lastName } = additionalData;
        const userPicksRef = doc(db, 'userPicks', userAuth.uid); // Reference to the picks document

        try {
            // Create the user profile document
            await setDoc(userRef, {
                displayName,
                email,
                firstName,
                lastName,
                duesPaidStatus: 'Unpaid',
            });

            // Create the initial empty user picks document to ensure it exists for all users
            await setDoc(userPicksRef, {});

        } catch (error) {
            console.error("Error creating user profile or picks document", error);
            // Re-throw the error to be handled by the calling function
            throw error;
        }
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
    try {
        await updateDoc(userRef, data);
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

export const getAllUsers = async (): Promise<User[]> => {
    const usersCollection = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCollection);
    const users: User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    return users;
};

// User Picks Management
export const getUserPicks = async (uid: string): Promise<{ [eventId: string]: PickSelection }> => {
    const picksRef = doc(db, 'userPicks', uid);
    const snapshot = await getDoc(picksRef);
    return snapshot.exists() ? snapshot.data() : {};
};

export const saveUserPicks = async (uid: string, eventId: string, picks: PickSelection) => {
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

// For Leaderboard
export const getAllUsersAndPicks = async () => {
    const usersCollection = collection(db, 'users');
    const userPicksCollection = collection(db, 'userPicks');

    const usersSnapshot = await getDocs(usersCollection);
    const userPicksSnapshot = await getDocs(userPicksCollection);

    const users: User[] = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
    const allPicks: { [userId: string]: { [eventId: string]: PickSelection } } = {};
    userPicksSnapshot.forEach(doc => {
        allPicks[doc.id] = doc.data();
    });

    return { users, allPicks };
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
